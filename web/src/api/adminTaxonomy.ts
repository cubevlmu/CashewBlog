import {
  mapCategoryToAdminCategoryRecord,
  mapTagToAdminTagRecord,
} from '@/mappers/adminApi'
import { requestJson } from '@/data/core/http'
import type { AdminCategoryRecord, AdminTagRecord } from '@/types/admin'
import type { ApiCategoryItem, ApiPageData, ApiTagItem } from '@/types/api'

export async function getAdminTags() {
  const data = await requestJson<ApiPageData<ApiTagItem>>('/api/v1/tags?page=1&page_size=100')
  return data.list.map(mapTagToAdminTagRecord)
}

export async function createAdminTag(payload: Pick<AdminTagRecord, 'name' | 'slug' | 'desc'>) {
  const data = await requestJson<{ tag: ApiTagItem }>('/api/v1/tags', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: payload.name,
      slug: payload.slug,
      desc: payload.desc,
      color: '#8b5cf6',
    }),
  })

  return mapTagToAdminTagRecord(data.tag)
}

export async function updateAdminTag(id: number, payload: Pick<AdminTagRecord, 'name' | 'slug' | 'desc'>) {
  const data = await requestJson<{ tag: ApiTagItem }>(`/api/v1/tags/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: payload.name,
      slug: payload.slug,
      desc: payload.desc,
      color: '#8b5cf6',
    }),
  })

  return mapTagToAdminTagRecord(data.tag)
}

export async function deleteAdminTags(ids: number[]) {
  await Promise.all(ids.map((id) => requestJson<void>(`/api/v1/tags/${id}`, { method: 'DELETE' })))
}

export async function getAdminCategories() {
  const data = await requestJson<ApiPageData<ApiCategoryItem>>('/api/v1/categories?page=1&page_size=100')
  return data.list.map(mapCategoryToAdminCategoryRecord)
}

export async function createAdminCategory(payload: Pick<AdminCategoryRecord, 'name' | 'slug' | 'desc' | 'parentId'>) {
  const data = await requestJson<{ category: ApiCategoryItem }>('/api/v1/categories', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: payload.name,
      slug: payload.slug,
      parent_id: payload.parentId ?? null,
      desc: payload.desc,
    }),
  })

  return mapCategoryToAdminCategoryRecord(data.category)
}

export async function updateAdminCategory(
  id: number,
  payload: Pick<AdminCategoryRecord, 'name' | 'slug' | 'desc' | 'parentId'>,
) {
  const data = await requestJson<{ category: ApiCategoryItem }>(`/api/v1/categories/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: payload.name,
      slug: payload.slug,
      parent_id: payload.parentId ?? null,
      desc: payload.desc,
    }),
  })

  return mapCategoryToAdminCategoryRecord(data.category)
}

export async function deleteAdminCategories(ids: number[]) {
  await Promise.all(ids.map((id) => requestJson<void>(`/api/v1/categories/${id}`, { method: 'DELETE' })))
}
