import type { AuthSession, AuthUser } from '@/types/auth'
import type { ApiLoginData, ApiUserProfile } from '@/types/api'
import { assetUrl } from '@/mappers/assetUrl'

function fallbackAvatar() {
  return '/placeholder-avatar.svg'
}

function pickAvatar(url?: string | null) {
  return url || fallbackAvatar()
}

function pickAvatarId(avatar: ApiUserProfile['avatar']) {
  if (!avatar || typeof avatar === 'number') {
    return typeof avatar === 'number' && avatar > 0 ? avatar : null
  }
  return avatar.id || null
}

export function mapLoginDataToAuthSession(data: ApiLoginData): AuthSession {
  return {
    user: {
      id: data.user.id,
      username: data.user.username,
      displayName: data.user.nickname || data.user.username,
      role: data.user.role === 'admin' || data.user.role === 'super_admin' ? 'admin' : 'user',
      avatar: pickAvatar(assetUrl(data.user.avatar)),
      avatarId: pickAvatarId(data.user.avatar),
      bio: data.user.bio || '',
      email: '',
      gender: data.user.gender === 'female' || data.user.gender === 'male' ? data.user.gender : 'unknown',
      website: data.user.website || '',
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
    avatar: pickAvatar(assetUrl(user.avatar)),
    avatarId: pickAvatarId(user.avatar),
    bio: user.bio || '',
    email: user.email,
    gender: user.gender === 'female' || user.gender === 'male' ? user.gender : 'unknown',
    website: user.website || '',
  }
}
