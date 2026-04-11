import { mapCategoryToTaxonomyItem, mapTagToTaxonomyItem } from '@/mappers/taxonomyApi'
import type { ApiCategoryItem, ApiTagItem } from '@/types/api'
import type { TaxonomyItemVM } from '@/types/vm'

export function mapApiTagToTaxonomyVM(tag: ApiTagItem): TaxonomyItemVM {
  return mapTagToTaxonomyItem(tag)
}

export function mapApiCategoryToTaxonomyVM(category: ApiCategoryItem): TaxonomyItemVM {
  return mapCategoryToTaxonomyItem(category)
}
