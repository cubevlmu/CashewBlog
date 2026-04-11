import { mapUserToAdminUserRecord } from '@/mappers/adminApi'
import { requestJson } from '@/data/core/http'
import type { AdminUserRecord } from '@/types/admin'
import type { ApiPageData, ApiUserProfile } from '@/types/api'

export async function getAdminUsers() {
  const data = await requestJson<ApiPageData<ApiUserProfile>>('/api/v1/users?page=1&page_size=100')
  return data.list.map(mapUserToAdminUserRecord)
}

export async function getAdminUserById(id: number) {
  const data = await requestJson<{ user: ApiUserProfile }>(`/api/v1/users/${id}`)
  return mapUserToAdminUserRecord(data.user)
}

export async function createAdminUser(
  payload: Pick<AdminUserRecord, 'username' | 'displayName' | 'email' | 'role' | 'avatar' | 'gender' | 'bio'>,
) {
  const data = await requestJson<{ user: ApiUserProfile }>('/api/v1/users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: payload.username,
      nickname: payload.displayName,
      email: payload.email,
      role: payload.role === 'admin' ? 'admin' : 'user',
      gender: payload.gender,
      bio: payload.bio,
      website: '',
      avatar_id: 0,
      password: 'ChangeMe123!',
    }),
  })

  return mapUserToAdminUserRecord(data.user)
}

export async function updateAdminUser(
  id: number,
  payload: Pick<AdminUserRecord, 'displayName' | 'email' | 'role' | 'avatar' | 'gender' | 'bio'>,
) {
  const data = await requestJson<{ user: ApiUserProfile }>(`/api/v1/users/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      nickname: payload.displayName,
      email: payload.email,
      role: payload.role === 'admin' ? 'admin' : 'user',
      gender: payload.gender,
      bio: payload.bio,
      website: '',
      avatar_id: 0,
    }),
  })

  return mapUserToAdminUserRecord(data.user)
}

export async function deleteAdminUsers(ids: number[]) {
  await Promise.all(ids.map((id) => requestJson<void>(`/api/v1/users/${id}`, { method: 'DELETE' })))
}
