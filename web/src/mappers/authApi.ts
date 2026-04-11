import type { AuthSession, AuthUser } from '@/types/auth'
import type { ApiLoginData, ApiUserProfile } from '@/types/api'

function fallbackAvatar() {
  return '/placeholder-avatar.svg'
}

function pickAvatar(url?: string | null) {
  return url || fallbackAvatar()
}

export function mapLoginDataToAuthSession(data: ApiLoginData): AuthSession {
  return {
    user: {
      id: data.user.id,
      username: data.user.username,
      displayName: data.user.nickname || data.user.username,
      role: data.user.role === 'admin' || data.user.role === 'super_admin' ? 'admin' : 'user',
      avatar: pickAvatar(data.user.avatar?.url),
      bio: data.user.bio || '',
      email: '',
      gender: data.user.gender === 'female' || data.user.gender === 'male' ? data.user.gender : 'unknown',
    },
    tokens: {
      token: data.access_token,
      refreshToken: data.refresh_token,
      sessionToken: data.access_token,
    },
  }
}

export function mapUserProfileToAuthUser(user: ApiUserProfile): AuthUser {
  return {
    id: user.id,
    username: user.username,
    displayName: user.nickname || user.username,
    role: user.role === 'admin' || user.role === 'super_admin' ? 'admin' : 'user',
    avatar: pickAvatar(user.avatar?.url),
    bio: user.bio || '',
    email: user.email,
    gender: user.gender === 'female' || user.gender === 'male' ? user.gender : 'unknown',
  }
}
