import { mapAssetToAdminAssetRecord } from '@/mappers/adminApi'
import { requestJson } from '@/data/core/http'
import type { ApiAssetItem, ApiPageData } from '@/types/api'

const defaultUploadMaxBytes = 10 * 1024 * 1024

export interface AdminAssetsQuery {
  page?: number
  pageSize?: number
  keyword?: string
  type?: 'all' | 'image' | 'file'
  scope?: 'all' | 'mine'
  state?: 'normal' | 'hidden' | 'deleted'
}

export async function getAdminAssets(query: AdminAssetsQuery = {}) {
  const params = new URLSearchParams({
    page: String(query.page ?? 1),
    page_size: String(query.pageSize ?? 100),
  })
  if (query.keyword?.trim()) {
    params.set('keyword', query.keyword.trim())
  }
  if (query.type && query.type !== 'all') {
    params.set('type', query.type)
  }
  if (query.scope && query.scope !== 'all') {
    params.set('scope', query.scope)
  }
  if (query.state) {
    params.set('state', query.state)
  }

  const data = await requestJson<ApiPageData<ApiAssetItem>>(`/api/v1/assets?${params.toString()}`)
  return data.list.map(mapAssetToAdminAssetRecord)
}

export async function getAdminAssetById(id: number) {
  const data = await requestJson<{ asset: ApiAssetItem }>(`/api/v1/assets/${id}/meta`)
  return mapAssetToAdminAssetRecord(data.asset)
}

export async function deleteAdminAssets(ids: number[]) {
  await Promise.all(ids.map((id) => requestJson<void>(`/api/v1/assets/${id}`, { method: 'DELETE' })))
}

export async function getAdminUploadLimitBytes() {
  const data = await requestJson<{ max_bytes: number }>('/api/v1/assets/upload-limit')
  const value = Number(data.max_bytes)
  return Number.isFinite(value) && value > 0 ? value : defaultUploadMaxBytes
}

export async function uploadAdminAsset(file: File) {
  const formData = new FormData()
  formData.append('file', file)

  const data = await requestJson<{ asset: ApiAssetItem }>('/api/v1/assets/upload', {
    method: 'POST',
    body: formData,
  })

  return mapAssetToAdminAssetRecord(data.asset)
}
