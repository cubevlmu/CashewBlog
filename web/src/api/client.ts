import { getAuthSession, setAuthSession } from '@/stores/authStore'

import type { ApiRefreshData, ApiResponse } from '@/types/api'

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || ''
const minRequestIntervalMs = Number(import.meta.env.VITE_API_MIN_INTERVAL_MS ?? 250)
const maxRateLimitRetries = Number(import.meta.env.VITE_API_MAX_RATE_LIMIT_RETRIES ?? 2)
let requestQueue = Promise.resolve()
let nextRequestAt = 0
let refreshPromise: Promise<boolean> | null = null

type RequestAttempt<T> =
  | {
      ok: true
      data: T
    }
  | {
      ok: false
      status: number
      message: string
      retryAfterMs?: number
    }

export class ApiRequestError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiRequestError'
    this.status = status
  }
}

export function isUnauthorizedError(error: unknown) {
  return error instanceof ApiRequestError && error.status === 401
}

function wait(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}

function createRequestUrl(path: string) {
  if (/^https?:\/\//i.test(path)) {
    return path
  }

  if (!apiBaseUrl) {
    return path
  }

  return `${apiBaseUrl.replace(/\/$/, '')}/${path.replace(/^\//, '')}`
}

async function waitForRequestSlot() {
  const now = Date.now()
  const delay = Math.max(0, nextRequestAt - now)

  if (delay > 0) {
    await wait(delay)
  }

  nextRequestAt = Date.now() + minRequestIntervalMs
}

function scheduleRequest<T>(task: () => Promise<T>) {
  const scheduled = requestQueue
    .catch(() => undefined)
    .then(waitForRequestSlot)
    .then(task)

  requestQueue = scheduled.then(() => undefined, () => undefined)
  return scheduled
}

function parseRetryAfter(response: Response) {
  const retryAfter = response.headers.get('Retry-After')
  if (!retryAfter) {
    return undefined
  }

  const seconds = Number(retryAfter)
  if (Number.isFinite(seconds)) {
    return Math.max(0, seconds * 1000)
  }

  const retryAt = Date.parse(retryAfter)
  if (Number.isFinite(retryAt)) {
    return Math.max(0, retryAt - Date.now())
  }

  return undefined
}

function createHeaders(init?: HeadersInit) {
  const headers = new Headers(init)
  const token = getAuthSession()?.tokens.token

  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  return headers
}

function isExpiredTokenError(result: RequestAttempt<unknown>) {
  return !result.ok && result.status === 401 && result.message.toLowerCase().includes('token expired')
}

async function refreshExpiredToken() {
  const session = getAuthSession()
  const refreshToken = session?.tokens.refreshToken
  if (!session || !refreshToken) {
    setAuthSession(null)
    return false
  }

  if (!refreshPromise) {
    refreshPromise = fetch(createRequestUrl('/api/v1/auth/refresh'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
    })
      .then(async (response) => {
        const payload = (await response.json().catch(() => null)) as ApiResponse<ApiRefreshData> | null
        const payloadStatus = payload?.status ?? payload?.code
        const ok = response.ok && payload && (payloadStatus === undefined || (payloadStatus >= 200 && payloadStatus < 300) || payloadStatus === 0)
        if (!ok || !payload?.data) {
          setAuthSession(null)
          return false
        }

        setAuthSession({
          ...session,
          tokens: {
            token: payload.data.access_token,
            refreshToken: payload.data.refresh_token,
            sessionToken: payload.data.access_token,
          },
        })
        return true
      })
      .catch(() => {
        setAuthSession(null)
        return false
      })
      .finally(() => {
        refreshPromise = null
      })
  }

  return refreshPromise
}

async function executeRequest<T>(url: string, requestOptions: RequestInit): Promise<RequestAttempt<T>> {
  const response = await fetch(url, requestOptions)
  const payload = (await response.json().catch(() => null)) as ApiResponse<T> | null
  const payloadStatus = payload?.status ?? payload?.code
  const payloadOk = payloadStatus === undefined || (payloadStatus >= 200 && payloadStatus < 300) || payloadStatus === 0

  if (response.ok && payload && payloadOk) {
    return {
      ok: true,
      data: payload.data,
    }
  }

  return {
    ok: false,
    status: response.status,
    message: payload?.message || `Request failed: ${response.status}`,
    retryAfterMs: parseRetryAfter(response),
  }
}

export async function requestJson<T>(path: string, options?: RequestInit): Promise<T> {
  const requestOptions: RequestInit = {
    ...options,
    headers: createHeaders(options?.headers),
  }
  const url = createRequestUrl(path)

  for (let attempt = 0; attempt <= maxRateLimitRetries; attempt += 1) {
    const result = await scheduleRequest(() => executeRequest<T>(url, requestOptions))

    if (result.ok) {
      return result.data
    }

    if (isExpiredTokenError(result)) {
      if (await refreshExpiredToken()) {
        requestOptions.headers = createHeaders(options?.headers)
        const retryResult = await scheduleRequest(() => executeRequest<T>(url, requestOptions))
        if (retryResult.ok) {
          return retryResult.data
        }
        throw new ApiRequestError(retryResult.message, retryResult.status)
      }

      throw new ApiRequestError('登录已失效，请重新登录', 401)
    }

    if (result.status !== 429 || attempt === maxRateLimitRetries) {
      throw new ApiRequestError(result.message, result.status)
    }

    const retryDelay = result.retryAfterMs ?? 1000 * 2 ** attempt
    await wait(retryDelay)
  }

  throw new Error('请求过于频繁，请稍后再试')
}
