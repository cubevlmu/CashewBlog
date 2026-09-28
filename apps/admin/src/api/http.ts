// Minimal fetch wrapper for the CashewBlog REST API.
// - JSON in/out, same-origin cookies.
// - CSRF double-submit: the server sets the readable XSRF-TOKEN cookie; every state-changing
//   /api/admin request echoes it in the X-XSRF-TOKEN header.
// - Errors are RFC 7807 problem details and surface as ApiError.

export const CSRF_HEADER = "X-XSRF-TOKEN";
const CSRF_COOKIE = "XSRF-TOKEN";

/** Field errors of a validation problem, keyed by camelCase field path (e.g. "general.siteName"). */
export type FieldErrors = Record<string, string[]>;

export class ApiError extends Error {
  constructor(
    readonly status: number,
    /** Machine-readable `error` extension (e.g. "validation_failed", "media_in_use"). */
    readonly code: string,
    readonly title: string,
    readonly detail: string | undefined,
    readonly fieldErrors: FieldErrors,
    /** Full problem body, for endpoint-specific extensions such as `references`. */
    readonly body: Record<string, unknown>,
  ) {
    super(detail ? `${title} ${detail}` : title);
    this.name = "ApiError";
  }
}

/** Builds an ApiError from a (possibly non-JSON) response body. */
export function toApiError(status: number, body: unknown): ApiError {
  const problem =
    body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const errors =
    problem.errors && typeof problem.errors === "object"
      ? (problem.errors as FieldErrors)
      : {};
  const title =
    typeof problem.title === "string" ? problem.title : `HTTP ${status}`;
  const detail =
    typeof problem.detail === "string" ? problem.detail : undefined;
  const code =
    typeof problem.error === "string" ? problem.error : `http_${status}`;
  return new ApiError(status, code, title, detail, errors, problem);
}

let unauthorizedHandler: (() => void) | null = null;

/** Called on 401 from any admin endpoint (except login itself). */
export function onUnauthorized(handler: () => void): void {
  unauthorizedHandler = handler;
}

export function readCookie(name: string): string | null {
  for (const part of document.cookie.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return decodeURIComponent(rest.join("="));
  }
  return null;
}

async function csrfToken(): Promise<string> {
  const existing = readCookie(CSRF_COOKIE);
  if (existing) return existing;
  const res = await fetch("/api/admin/csrf", { credentials: "same-origin" });
  const body = (await res.json()) as { token: string };
  return readCookie(CSRF_COOKIE) ?? body.token;
}

export function isUnsafe(method: string): boolean {
  return !["GET", "HEAD", "OPTIONS"].includes(method.toUpperCase());
}

export type Query = Record<
  string,
  string | number | boolean | null | undefined
>;

export function buildUrl(path: string, query?: Query): string {
  if (!query) return path;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== "")
      params.set(key, String(value));
  }
  const qs = params.toString();
  return qs ? `${path}?${qs}` : path;
}

export interface RequestOptions {
  query?: Query;
  body?: unknown;
  /** Keep the request alive while the page unloads (best-effort autosave). */
  keepalive?: boolean;
  /** Do not trigger the global 401 redirect (login form handles its own errors). */
  skipAuthRedirect?: boolean;
}

/** Request headers for state-changing admin calls; also used by the XHR upload. */
export async function writeHeaders(): Promise<Record<string, string>> {
  return { [CSRF_HEADER]: await csrfToken() };
}

export async function request<T>(
  method: string,
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const headers: Record<string, string> = { Accept: "application/json" };
  const multipart = options.body instanceof FormData;
  if (options.body !== undefined && !multipart)
    headers["Content-Type"] = "application/json";
  const needsCsrf = isUnsafe(method) && path.startsWith("/api/admin");

  const send = async () => {
    if (needsCsrf) Object.assign(headers, await writeHeaders());
    return fetch(buildUrl(path, options.query), {
      method,
      headers,
      credentials: "same-origin",
      body: multipart
        ? (options.body as FormData)
        : options.body === undefined
          ? undefined
          : JSON.stringify(options.body),
      keepalive: options.keepalive,
    });
  };

  let res = await send();
  let body = await parseBody(res);

  // A stale token (e.g. issued for a previous identity) is refreshed once.
  if (
    res.status === 400 &&
    needsCsrf &&
    (body as { error?: string } | null)?.error === "csrf_invalid"
  ) {
    await fetch("/api/admin/csrf", { credentials: "same-origin" });
    res = await send();
    body = await parseBody(res);
  }

  if (!res.ok) {
    if (
      res.status === 401 &&
      !options.skipAuthRedirect &&
      path.startsWith("/api/admin")
    )
      unauthorizedHandler?.();
    throw toApiError(res.status, body);
  }
  return body as T;
}

async function parseBody(res: Response): Promise<unknown> {
  if (res.status === 204) return undefined;
  const text = await res.text();
  if (!text) return undefined;
  const type = res.headers.get("Content-Type") ?? "";
  if (type.includes("json")) {
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  }
  return text;
}

export const http = {
  get: <T>(path: string, query?: Query) => request<T>("GET", path, { query }),
  post: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>("POST", path, { ...options, body }),
  put: <T>(path: string, body?: unknown) => request<T>("PUT", path, { body }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>("PATCH", path, { body }),
  del: <T = void>(path: string) => request<T>("DELETE", path),
};
