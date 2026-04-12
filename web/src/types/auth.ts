export type AuthRole = 'admin' | 'editor' | 'user'

export interface AuthUser {
  id: number
  username: string
  displayName: string
  role: AuthRole
  avatar: string
  avatarId: number | null
  bio: string
  email: string
  gender: 'male' | 'female' | 'unknown'
  website: string
}

export interface AuthTokens {
  token: string
  refreshToken: string
  sessionToken: string
}

export interface AuthSession {
  user: AuthUser
  tokens: AuthTokens
}
