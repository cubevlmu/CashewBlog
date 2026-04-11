import { mapAssetToAdminAssetRecord } from '@/mappers/adminApi'
import { requestJson } from '@/data/core/http'
import type { ApiAssetItem, ApiPageData } from '@/types/api'

export async function getAdminAssets() {
  const data = await requestJson<ApiPageData<ApiAssetItem>>('/api/v1/assets?page=1&page_size=100')
  return data.list.map(mapAssetToAdminAssetRecord)
}

export async function getAdminAssetById(id: number) {
  const data = await requestJson<{ asset: ApiAssetItem }>(`/api/v1/assets/${id}`)
  return mapAssetToAdminAssetRecord(data.asset)
}

export async function deleteAdminAssets(ids: number[]) {
  await Promise.all(ids.map((id) => requestJson<void>(`/api/v1/assets/${id}`, { method: 'DELETE' })))
}
