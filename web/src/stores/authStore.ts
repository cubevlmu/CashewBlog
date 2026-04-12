import { computed, reactive } from 'vue'

import type { AuthSession, AuthUser } from '@/types/auth'

const storageKey = 'cashew:auth-session'

const state = reactive<{
  session: AuthSession | null
}>({
  session: null,
})

function normalizeUser(user: AuthUser): AuthUser {
  return {
    ...user,
    avatar: user.avatar || '/placeholder-avatar.svg',
    avatarId: user.avatarId ?? null,
    bio: user.bio || '这个账号暂时还没有填写个人简介。',
    email: user.email || `${user.username}@cashew.blog`,
    gender: user.gender || 'unknown',
    website: user.website || '',
  }
}

function normalizeSession(session: AuthSession): AuthSession {
  return {
    ...session,
    user: normalizeUser(session.user),
  }
}

function readStoredSession(): AuthSession | null {
  if (typeof window === 'undefined') {
    return null
  }

  const raw = window.localStorage.getItem(storageKey)
  if (!raw) {
    return null
  }

  try {
    return normalizeSession(JSON.parse(raw) as AuthSession)
  } catch {
    window.localStorage.removeItem(storageKey)
    return null
  }
}

function persistSession(session: AuthSession | null) {
  if (typeof window === 'undefined') {
    return
  }

  if (!session) {
    window.localStorage.removeItem(storageKey)
    return
  }

  window.localStorage.setItem(storageKey, JSON.stringify(normalizeSession(session)))
}

export function setAuthSession(session: AuthSession | null) {
  state.session = session ? normalizeSession(session) : null
  persistSession(state.session)
}

export function getAuthSession() {
  return state.session
}

state.session = readStoredSession()

export const authState = reactive({
  get session() {
    return state.session
  },
  get user() {
    return state.session?.user ?? null
  },
  get isLoggedIn() {
    return Boolean(state.session)
  },
  get isAdmin() {
    return state.session?.user.role === 'admin'
  },
})

export const authComputed = {
  token: computed(() => state.session?.tokens.token ?? ''),
  refreshToken: computed(() => state.session?.tokens.refreshToken ?? ''),
  sessionToken: computed(() => state.session?.tokens.sessionToken ?? ''),
}
