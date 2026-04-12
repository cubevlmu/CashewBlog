import type { ApiPublicSettings, ApiSettingsRootData } from '@/types/api'

import { requestJson } from '@/data/core/http'

let publicSettingsRequest: Promise<ApiPublicSettings> | null = null

export function getPublicSettings() {
  publicSettingsRequest ??= requestJson<ApiPublicSettings>('/api/v1/settings/public').catch((error) => {
    publicSettingsRequest = null
    throw error
  })

  return publicSettingsRequest
}

export function invalidatePublicSettingsCache() {
  publicSettingsRequest = null
}

export function getAdminSettingsByRoot(root: string) {
  return requestJson<ApiSettingsRootData>(`/api/v1/admin/settings/${encodeURIComponent(root)}`)
}
