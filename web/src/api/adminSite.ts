import { mapHomeConfigToHomePatch } from '@/mappers/siteApi'
import { requestJson } from '@/data/core/http'
import { invalidatePublicSettingsCache } from '@/api/settings'
import type { HomeConfig } from '@/types/site-config'

export function patchAdminHomeConfig(config: HomeConfig) {
  return requestJson<{ home: {
    banner_title: string
    banner_subtitle: string
    banner_image: string
    typing_animation: boolean
  } }>('/api/v1/admin/site/home', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(mapHomeConfigToHomePatch(config)),
  }).then((result) => {
    invalidatePublicSettingsCache()
    return result
  })
}
