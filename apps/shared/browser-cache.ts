export type CacheBucket = 'static' | 'images' | 'pages';
export const cacheNames: Record<CacheBucket, string> = {
  static: 'cashewblog-static-v1', images: 'cashewblog-images-v1', pages: 'cashewblog-pages-v1',
};
export interface CacheUsage { bucket: CacheBucket; entries: number; bytes: number }
export interface CacheReport { available: boolean; buckets: CacheUsage[]; usage: number; quota: number; persisted: boolean }

export function cacheAvailable(): boolean {
  return typeof window !== 'undefined' && window.isSecureContext && 'caches' in window;
}
export function formatBytes(bytes: number): string {
  return bytes < 1024 ? `${bytes} B` : bytes < 1024 ** 2 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / 1024 ** 2).toFixed(1)} MB`;
}
export async function cacheReport(): Promise<CacheReport> {
  const result: CacheReport = { available: cacheAvailable(), buckets: [], usage: 0, quota: 0, persisted: false };
  if (!result.available) return result;
  const names = await caches.keys();
  for (const [bucket, name] of Object.entries(cacheNames)) {
    let entries = 0, bytes = 0;
    if (names.includes(name)) {
      const cache = await caches.open(name);
      for (const key of await cache.keys()) {
        const value = await cache.match(key);
        if (!value) continue;
        entries++;
        bytes += Number(value.headers.get('x-cashew-cache-size')) || 0;
      }
    }
    result.buckets.push({ bucket: bucket as CacheBucket, entries, bytes });
  }
  const estimate = await navigator.storage?.estimate?.();
  result.usage = estimate?.usage ?? 0;
  result.quota = estimate?.quota ?? 0;
  result.persisted = await navigator.storage?.persisted?.() ?? false;
  return result;
}

async function workerMessage(message: unknown): Promise<{ ok: boolean; complete?: number; total?: number }> {
  const registration = await navigator.serviceWorker.getRegistration('/');
  const worker = registration?.active;
  if (!worker) throw new Error('Cache worker unavailable');
  return new Promise((resolve, reject) => {
    const channel = new MessageChannel();
    const timer = setTimeout(() => { channel.port1.close(); reject(new Error('Cache worker timeout')); }, 30_000);
    channel.port1.onmessage = event => {
      clearTimeout(timer);
      channel.port1.close();
      resolve(event.data);
    };
    worker.postMessage(message, [channel.port2]);
  });
}
export async function clearCache(bucket?: CacheBucket): Promise<void> {
  if (!cacheAvailable()) return;
  const registration = 'serviceWorker' in navigator ? await navigator.serviceWorker.getRegistration('/') : undefined;
  if (registration?.active) {
    const reply = await workerMessage({ type: 'clear', bucket });
    if (!reply.ok) throw new Error('Cache clear failed');
  } else {
    for (const name of bucket ? [cacheNames[bucket]] : Object.values(cacheNames)) await caches.delete(name);
  }
  try { localStorage.removeItem('cashewblog-cache-ready'); } catch { /* Storage disabled. */ }
}
export async function persistCache(): Promise<boolean> {
  return await navigator.storage?.persist?.() ?? false;
}

let initialization: Promise<void> | undefined;
export function initializeCache(onReady: () => void): Promise<void> {
  if (!cacheAvailable() || !('serviceWorker' in navigator)) return Promise.resolve();
  initialization ??= (async () => {
    const registration = await navigator.serviceWorker.register('/browser-cache-worker.js', { scope: '/', updateViaCache: 'none' });
    if (!registration.active) await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Cache activation timeout')), 20_000);
      const worker = registration.installing ?? registration.waiting;
      if (!worker) { clearTimeout(timer); resolve(); return; }
      worker.addEventListener('statechange', () => {
        if (worker.state === 'activated') { clearTimeout(timer); resolve(); }
      });
    });
    if (document.readyState !== 'complete') await new Promise<void>(resolve => window.addEventListener('load', () => resolve(), { once: true }));
    const urls = [...new Set([
      ...performance.getEntriesByType('resource').map(entry => entry.name),
      ...Array.from(document.querySelectorAll<HTMLScriptElement>('script[src]')).map(entry => entry.src),
      ...Array.from(document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"],link[rel="modulepreload"]')).map(entry => entry.href),
    ])].filter(value => {
      const url = new URL(value, location.href);
      return url.origin === location.origin && /\.(?:js|mjs|css|woff2?|ttf|otf)$/i.test(url.pathname);
    });
    const reply = await workerMessage({ type: 'warm', urls });
    if (!reply.ok || !reply.total || reply.complete !== reply.total) return;
    const signature = urls.filter(value => /\.(?:js|css)$/i.test(new URL(value).pathname)).sort().join('|');
    let seen = false;
    try {
      seen = localStorage.getItem('cashewblog-cache-ready') === signature;
      localStorage.setItem('cashewblog-cache-ready', signature);
    } catch { /* Best effort. */ }
    if (!seen) onReady();
  })().catch(() => { /* Unsupported storage or network: ordinary HTTP caching still works. */ });
  return initialization;
}
