// The login page lives at a secret entrance (e.g. /k7x2mq9dfa) that the server only reveals by
// serving it. The SPA remembers the entrance after a successful sign-in so that logout and expired
// sessions can return there. Going to the entrance is always a full page load: the server sets the
// entrance cookie the login API requires.

const STORAGE_KEY = "cashew-admin-entrance";
export const DEFAULT_ENTRANCE = "/admin/login";

/** A login entrance: /admin/login or one top-level segment. */
export function isEntrancePath(path: string): boolean {
  return path === DEFAULT_ENTRANCE || /^\/[a-z0-9_-]{4,64}$/i.test(path);
}

export function rememberedEntrance(): string {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    if (value && isEntrancePath(value)) return value;
  } catch {
    // Storage blocked: fall back to the default below.
  }
  return DEFAULT_ENTRANCE;
}

export function rememberEntrance(path: string): void {
  if (!isEntrancePath(path)) return;
  try {
    localStorage.setItem(STORAGE_KEY, path);
  } catch {
    // Best effort only.
  }
}

/** Only admin pages other than the login itself may be returned to after sign-in. */
export function safeNext(next: unknown): string {
  return typeof next === "string" && /^\/admin(?:[/?#]|$)/.test(next) && !next.startsWith(DEFAULT_ENTRANCE) ? next : "/admin";
}

export function entranceUrl(entrance: string, next?: string): string {
  const target = next && safeNext(next) !== "/admin" ? `?next=${encodeURIComponent(next)}` : "";
  return entrance + target;
}

/** Full navigation to the remembered entrance (never a client-side route change). */
export function goToEntrance(next?: string): void {
  window.location.assign(entranceUrl(rememberedEntrance(), next));
}
