/* Shared by the public site and admin. Only explicit public HTML can be stored;
 * HTML is always validated online before reuse, including after login/logout. */
const NAMES = {
  static: 'cashewblog-static-v1',
  images: 'cashewblog-images-v1',
  pages: 'cashewblog-pages-v1',
};
const LIMITS = { static: [300, 64 * 1024 * 1024], images: [300, 96 * 1024 * 1024], pages: [30, 8 * 1024 * 1024] };
const SIZE = 'x-cashew-cache-size';
const TIME = 'x-cashew-cache-time';
let writes = Promise.resolve();
let generation = 0;

function bucketFor(url) {
  if (url.origin !== self.location.origin || /^\/(?:api|health|setup)(?:\/|$)/i.test(url.pathname)
    || url.pathname === '/browser-cache-worker.js') return null;
  const path = url.pathname;
  if (/\.(?:png|jpe?g|webp|avif|gif|ico|svg)$/i.test(path)) return 'images';
  if (/\.(?:js|mjs|css|woff2?|ttf|otf)$/i.test(path)) return 'static';
  return null;
}

function allowed(response, bucket) {
  if (response.status !== 200 || response.type !== 'basic' || response.redirected) return false;
  if (/\bno-store\b/i.test(response.headers.get('cache-control') || '')) return false;
  const type = response.headers.get('content-type') || '';
  if (bucket === 'pages') return response.headers.get('x-cashew-cache') === 'public-html' && !!response.headers.get('etag');
  return bucket === 'images' ? type.startsWith('image/') : /javascript|text\/css|font\/|application\/(?:font|octet-stream)/i.test(type);
}

async function store(request, response, bucket, epoch) {
  if (!allowed(response, bucket)) return false;
  const blob = await response.blob();
  if (blob.size > LIMITS[bucket][1] / 4) return false;
  const headers = new Headers(response.headers);
  headers.delete('content-length');
  headers.delete('content-encoding');
  headers.set(SIZE, String(blob.size));
  headers.set(TIME, String(Date.now()));
  const operation = writes.then(async () => {
    if (epoch !== generation) return false;
    const cache = await caches.open(NAMES[bucket]);
    await cache.put(request, new Response(blob, { status: 200, headers }));
    const entries = await Promise.all((await cache.keys()).map(async key => {
      const value = await cache.match(key);
      return { key, bytes: Number(value?.headers.get(SIZE)) || 0, time: Number(value?.headers.get(TIME)) || 0 };
    }));
    let bytes = entries.reduce((sum, entry) => sum + entry.bytes, 0);
    let count = entries.length;
    for (const entry of entries.sort((a, b) => a.time - b.time)) {
      if (count <= LIMITS[bucket][0] && bytes <= LIMITS[bucket][1]) break;
      await cache.delete(entry.key);
      count--;
      bytes -= entry.bytes;
    }
    return true;
  });
  writes = operation.catch(() => false);
  return operation;
}

async function asset(request, bucket) {
  const epoch = generation;
  const cache = await caches.open(NAMES[bucket]);
  const hit = await cache.match(request);
  const path = new URL(request.url).pathname;
  const immutable = /^\/(?:_astro|admin\/assets)\//.test(path) || /\bimmutable\b/i.test(hit?.headers.get('cache-control') || '');
  const fresh = hit && Date.now() - Number(hit.headers.get(TIME)) < 6 * 60 * 60 * 1000;
  if (hit && (immutable || fresh)) return hit;
  const response = await fetch(request);
  if (!allowed(response, bucket)) {
    await cache.delete(request);
    return response;
  }
  await store(request, response.clone(), bucket, epoch).catch(() => false);
  return response;
}

async function page(request) {
  const epoch = generation;
  const cache = await caches.open(NAMES.pages);
  const hit = await cache.match(request);
  const headers = new Headers(request.headers);
  if (hit?.headers.get('etag')) headers.set('If-None-Match', hit.headers.get('etag'));
  // No offline fallback for HTML: a published post may have become private.
  const response = await fetch(new Request(request, { headers, cache: 'no-store' }));
  if (response.status === 304 && hit && response.headers.get('x-cashew-cache') === 'public-html') return hit;
  if (allowed(response, 'pages')) await store(request, response.clone(), 'pages', epoch).catch(() => false);
  else await cache.delete(request);
  return response;
}

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil((async () => {
  for (const name of await caches.keys()) {
    if (name.startsWith('cashewblog-') && !Object.values(NAMES).includes(name)) await caches.delete(name);
  }
  await self.clients.claim();
})()));
self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET' || request.cache === 'no-store' || request.headers.has('range') || request.headers.has('authorization')) return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || /^\/(?:api|health|setup)(?:\/|$)/i.test(url.pathname)) return;
  const bucket = bucketFor(url);
  if (bucket) event.respondWith(asset(request, bucket).catch(() => fetch(request)));
  else if (request.mode === 'navigate' || request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(page(request));
  }
});
self.addEventListener('message', event => {
  const port = event.ports[0];
  if (!port) return;
  event.waitUntil((async () => {
    try {
      if (event.data?.type === 'clear') {
        generation++;
        await writes;
        const names = event.data.bucket ? [NAMES[event.data.bucket]].filter(Boolean) : Object.values(NAMES);
        for (const name of names) await caches.delete(name);
        port.postMessage({ ok: true });
      } else if (event.data?.type === 'warm') {
        const urls = [...new Set(event.data.urls)].slice(0, 100);
        let complete = 0;
        for (const value of urls) {
          const url = new URL(value, self.location.origin);
          const bucket = bucketFor(url);
          if (bucket !== 'static') continue;
          try {
            await asset(new Request(url.href, { credentials: 'same-origin' }), bucket);
            if (await (await caches.open(NAMES.static)).match(url.href)) complete++;
          } catch { /* Network/storage failure: do not report a completed cache. */ }
        }
        port.postMessage({ ok: true, complete, total: urls.filter(value => bucketFor(new URL(value, self.location.origin)) === 'static').length });
      }
    } catch { port.postMessage({ ok: false }); }
  })());
});
