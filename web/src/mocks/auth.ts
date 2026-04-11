import type { AuthRole, AuthSession, AuthUser } from '@/types/auth'

interface MockAccount extends AuthUser {
  password: string
}

let mockAccounts: MockAccount[] = [
  {
    id: 1,
    username: 'admin',
    displayName: 'Admin Cube',
    role: 'admin',
    avatar: '/placeholder-avatar.svg',
    bio: '维护站点配置、内容发布和后台模块，平时主要写前端工程和产品设计相关内容。',
    email: 'admin@cashew.blog',
    gender: 'unknown',
    password: 'admin123',
  },
  {
    id: 2,
    username: 'user',
    displayName: 'Normal Cube',
    role: 'user',
    avatar: '/placeholder-avatar.svg',
    bio: '一个长期写作中的普通用户，关注前端、体验设计和个人工作流。',
    email: 'user@cashew.blog',
    gender: 'unknown',
    password: 'user123',
  },
]

function mapAccountToSession(account: MockAccount, tokens?: AuthSession['tokens']): AuthSession {
  return {
    user: {
      id: account.id,
      username: account.username,
      displayName: account.displayName,
      role: account.role,
      avatar: account.avatar,
      bio: account.bio,
      email: account.email,
      gender: account.gender,
    },
    tokens: tokens ?? {
      token: createToken('token', account.username),
      refreshToken: createToken('refresh', account.username),
      sessionToken: createToken('session', account.username),
    },
  }
}

function createToken(prefix: string, username: string) {
  return `${prefix}_${username}_${Math.random().toString(36).slice(2, 12)}`
}

export async function mockLogin(username: string, password: string): Promise<AuthSession> {
  const account = mockAccounts.find((item) => item.username === username && item.password === password)

  await new Promise((resolve) => {
    window.setTimeout(resolve, 220)
  })

  if (!account) {
    throw new Error('用户名或密码错误')
  }

  return mapAccountToSession(account)
}

export function getMockAccountsPreview(): Array<{ username: string; password: string; role: AuthRole }> {
  return mockAccounts.map((account) => ({
    username: account.username,
    password: account.password,
    role: account.role,
  }))
}

export async function updateMockCurrentUserProfile(
  userId: number,
  payload: Pick<AuthUser, 'displayName' | 'email' | 'avatar' | 'bio' | 'gender' | 'role'>,
  tokens: AuthSession['tokens'],
): Promise<AuthSession> {
  let updated: MockAccount | null = null

  mockAccounts = mockAccounts.map((account) => {
    if (account.id !== userId) {
      return account
    }

    updated = { ...account, ...payload }
    return updated
  })

  await new Promise((resolve) => {
    window.setTimeout(resolve, 220)
  })

  if (!updated) {
    throw new Error('当前用户不存在')
  }

  return mapAccountToSession(updated, tokens)
}

export async function updateMockCurrentUserPassword(userId: number, currentPassword: string, nextPassword: string): Promise<void> {
  const target = mockAccounts.find((account) => account.id === userId)

  await new Promise((resolve) => {
    window.setTimeout(resolve, 220)
  })

  if (!target) {
    throw new Error('当前用户不存在')
  }

  if (target.password !== currentPassword) {
    throw new Error('当前密码不正确')
  }

  target.password = nextPassword
}
