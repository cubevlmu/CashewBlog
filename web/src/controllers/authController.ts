import { getAuthSession, setAuthSession } from '@/stores/authStore'

import { clearAppNotice, setAppNotice } from '@/stores/appStatusStore'
import { checkBackendHealth, fetchAuthStatus, login, refreshAuthTokens, updateMePassword, updateMeProfile } from '@/repositories/authRepository'
import { isUnauthorizedError } from '@/data/core/http'
import type { AuthUser } from '@/types/auth'

export async function loginWithPassword(username: string, password: string) {
  const session = await login(username.trim(), password)
  setAuthSession(session)
  clearAppNotice('auth-expired')
  return session
}

export function logout() {
  setAuthSession(null)
}

export async function updateCurrentUserProfile(payload: Pick<AuthUser, 'displayName' | 'email' | 'avatarId' | 'bio' | 'gender' | 'website' | 'role'>) {
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

export async function initializeAuthSession() {
  try {
    await checkBackendHealth()
    clearAppNotice('backend-error')
  } catch (error) {
    setAppNotice('backend-error', error instanceof Error ? `后端服务异常：${error.message}` : '后端服务异常')
    return
  }

  const session = getAuthSession()
  if (!session) {
    return
  }

  try {
    await fetchAuthStatus()
    return
  } catch (error) {
    if (!isUnauthorizedError(error) || !session.tokens.refreshToken) {
      setAuthSession(null)
      setAppNotice('auth-expired', '登录状态校验失败，请重新登录')
      return
    }
  }

  try {
    const tokens = await refreshAuthTokens(session.tokens.refreshToken)
    const nextSession = {
      ...session,
      tokens,
    }
    setAuthSession(nextSession)
    await fetchAuthStatus()
    clearAppNotice('auth-expired')
  } catch {
    setAuthSession(null)
    setAppNotice('auth-expired', '登录已失效，请重新登录')
  }
}
