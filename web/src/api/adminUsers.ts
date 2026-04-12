import { mapUserToAdminUserRecord } from '@/mappers/adminApi'
import { requestJson } from '@/data/core/http'
import type { AdminUserRecord } from '@/types/admin'
import type { ApiPageData, ApiUserProfile } from '@/types/api'

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

function userPayload(payload: Pick<AdminUserRecord, 'displayName' | 'email' | 'role' | 'avatarId' | 'gender' | 'bio' | 'website'>) {
  const body: Record<string, unknown> = {
    nickname: payload.displayName,
    email: payload.email,
    role: payload.role === 'admin' ? 'admin' : 'user',
    gender: payload.gender,
    bio: payload.bio,
    website: payload.website,
  }
  if (payload.avatarId !== undefined) {
    body.avatar_id = normalizeAvatarId(payload.avatarId)
  }
  return body
}

export async function getAdminUsers() {
  const data = await requestJson<ApiPageData<ApiUserProfile>>('/api/v1/users?page=1&page_size=100')
  return data.list.map(mapUserToAdminUserRecord)
}

export async function getAdminUserById(id: number) {
  const data = await requestJson<{ user: ApiUserProfile }>(`/api/v1/users/${id}`)
  return mapUserToAdminUserRecord(data.user)
}

export async function createAdminUser(
  payload: Pick<AdminUserRecord, 'username' | 'displayName' | 'email' | 'role' | 'avatarId' | 'gender' | 'bio' | 'website'>,
) {
  const data = await requestJson<{ user: ApiUserProfile }>('/api/v1/users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...userPayload(payload),
      username: payload.username,
      password: 'ChangeMe123!',
    }),
  })

  return mapUserToAdminUserRecord(data.user)
}

export async function updateAdminUser(
  id: number,
  payload: Pick<AdminUserRecord, 'displayName' | 'email' | 'role' | 'avatarId' | 'gender' | 'bio' | 'website'>,
) {
  const data = await requestJson<{ user: ApiUserProfile }>(`/api/v1/users/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(userPayload(payload)),
  })

  return mapUserToAdminUserRecord(data.user)
}

export async function deleteAdminUsers(ids: number[]) {
  await Promise.all(ids.map((id) => requestJson<void>(`/api/v1/users/${id}`, { method: 'DELETE' })))
}
