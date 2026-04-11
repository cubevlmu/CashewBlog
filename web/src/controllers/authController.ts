import { getAuthSession, setAuthSession } from '@/stores/authStore'

import { getDemoAccounts, login, updateMePassword, updateMeProfile } from '@/repositories/authRepository'
import type { AuthUser } from '@/types/auth'

export async function loginWithPassword(username: string, password: string) {
  const session = await login(username.trim(), password)
  setAuthSession(session)
  return session
}

export function logout() {
  setAuthSession(null)
}

export {
  getDemoAccounts,
}

export async function updateCurrentUserProfile(payload: Pick<AuthUser, 'displayName' | 'email' | 'avatar' | 'bio' | 'gender' | 'role'>) {
  const session = getAuthSession()
  if (!session) {
    throw new Error('当前未登录')
  }

  const nextSession = await updateMeProfile(payload, session.tokens)
  setAuthSession(nextSession)
  return nextSession
}

export async function updateCurrentUserPassword(currentPassword: string, nextPassword: string) {
  const session = getAuthSession()
  if (!session) {
    throw new Error('当前未登录')
  }

  await updateMePassword(currentPassword, nextPassword)
}
