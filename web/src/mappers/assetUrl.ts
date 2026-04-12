import type { ApiAssetValue } from '@/types/api'

export function assetUrl(asset?: ApiAssetValue | null) {
  if (!asset) return ''

  if (typeof asset === 'number') {
    return asset > 0 ? `/api/v1/assets/${asset}` : ''
  }

  return asset.url || `/api/v1/assets/${asset.id}`
}
