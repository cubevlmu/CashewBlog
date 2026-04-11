import { mockApiServer } from '@/debug/mockServer'
import { getAuthSession } from '@/stores/authStore'

import type { ApiResponse } from '@/types/api'
import { isMockDataSourceEnabled } from '@/data/core/dataSource'

function createHeaders(init?: HeadersInit) {
  const headers = new Headers(init)
  const token = getAuthSession()?.tokens.token

  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  return headers
}

export async function requestJson<T>(path: string, options?: RequestInit): Promise<T> {
  const requestOptions = {
    ...options,
    headers: createHeaders(options?.headers),
  }

  if (isMockDataSourceEnabled()) {
    return mockApiServer.requestJson<T>(path, requestOptions)
  }

  const response = await fetch(path, requestOptions)
  const payload = (await response.json().catch(() => null)) as ApiResponse<T> | null

  if (!response.ok || !payload || payload.code !== 0) {
    throw new Error(payload?.message || `Request failed: ${response.status}`)
  }

  return payload.data
}
