import type { AuthRole, AuthSession, AuthUser } from '@/types/auth'
import type { ApiAuthMeData, ApiLoginData } from '@/types/api'

import { mapLoginDataToAuthSession, mapUserProfileToAuthUser } from '@/mappers/authApi'
import { requestJson } from '@/data/core/http'

export async function login(username: string, password: string) {
  const data = await requestJson<ApiLoginData>('/api/v1/auth/login', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({username, password}),
  })
  return mapLoginDataToAuthSession(data)
}

export function getDemoAccounts(): Array<{ username: string; password: string; role: AuthRole }> {
  return []
}

export async function updateMeProfile(
  payload: Pick<AuthUser, 'displayName' | 'email' | 'avatar' | 'bio' | 'gender' | 'role'>,
  tokens: AuthSession['tokens'],
) {
  const data = await requestJson<ApiAuthMeData>('/api/v1/users/me', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      nickname: payload.displayName,
      email: payload.email,
      gender: payload.gender,
      bio: payload.bio,
      website: '',
    }),
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
