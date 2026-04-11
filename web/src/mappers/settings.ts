import { mapPublicSettingsToHomeConfig } from '@/mappers/siteApi'
import type { ApiPublicSettings } from '@/types/api'
import type { SiteConfigVM } from '@/types/vm'

export function mapApiPublicSettingsToSiteConfigVM(settings: ApiPublicSettings): SiteConfigVM {
  return mapPublicSettingsToHomeConfig(settings)
}
