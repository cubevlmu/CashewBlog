import type { ApiPublicSettings } from '@/types/api'

import { requestJson } from '@/data/core/http'

export function getPublicSettings() {
  return requestJson<ApiPublicSettings>('/api/v1/settings/public')
}
