import type { AuthSession, AuthUser } from '@/types/auth'
import type { ApiAuthMeData, ApiAuthStatusData, ApiLoginData, ApiRefreshData } from '@/types/api'

import { mapLoginDataToAuthSession, mapUserProfileToAuthUser } from '@/mappers/authApi'
import { requestJson } from '@/data/core/http'

const sha256Pattern = /^[a-f0-9]{64}$/i

async function toSha256Hex(value: string) {
  if (sha256Pattern.test(value)) {
    return value.toLowerCase()
  }

  const bytes = new TextEncoder().encode(value)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

function normalizeAvatarId(value: unknown) {
  if (typeof value === 'number') {
    return value > 0 ? value : null
  }
  if (typeof value === 'string') {
    const parsed = Number(value)
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null
  }
  return null
}

export async function login(username: string, password: string) {
  const passwordHash = await toSha256Hex(password)
  const data = await requestJson<ApiLoginData>('/api/v1/auth/login', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({username, password: passwordHash}),
  })
  return mapLoginDataToAuthSession(data)
}

export function checkBackendHealth() {
  return requestJson<{ status: string }>('/api/v1/health')
}

export function fetchAuthStatus() {
  return requestJson<ApiAuthStatusData>('/api/v1/auth/me')
}

export async function refreshAuthTokens(refreshToken: string): Promise<AuthSession['tokens']> {
  const data = await requestJson<ApiRefreshData>('/api/v1/auth/refresh', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: refreshToken }),
  })

  return {
    token: data.access_token,
    refreshToken: data.refresh_token,
    sessionToken: data.access_token,
  }
}

export async function updateMeProfile(
  payload: Pick<AuthUser, 'displayName' | 'email' | 'avatarId' | 'bio' | 'gender' | 'website' | 'role'>,
  tokens: AuthSession['tokens'],
) {
  const body: Record<string, unknown> = {
    nickname: payload.displayName,
    email: payload.email,
    gender: payload.gender,
    bio: payload.bio,
    website: payload.website,
  }
  if (payload.avatarId !== undefined) {
    body.avatar_id = normalizeAvatarId(payload.avatarId)
  }

  const data = await requestJson<ApiAuthMeData>('/api/v1/users/me', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  return {
    user: mapUserProfileToAuthUser(data.user),
    tokens,
  }
}

export function updateMePassword(currentPassword: string, nextPassword: string) {
  return requestJson<void>('/api/v1/users/me/password', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      current_password: currentPassword,
      next_password: nextPassword,
    }),
  })
}
