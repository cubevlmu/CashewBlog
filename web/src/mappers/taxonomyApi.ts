import type { TaxonomyItem } from '@/types/content'
import type { ApiCategoryItem, ApiTagItem } from '@/types/api'

export function mapTagToTaxonomyItem(tag: ApiTagItem): TaxonomyItem {
  return {
    id: tag.id,
    name: tag.name,
    slug: tag.slug,
    color: tag.color,
    postCount: tag.post_count ?? 0,
  }
}

export function mapCategoryToTaxonomyItem(category: ApiCategoryItem): TaxonomyItem {
  return {
    id: category.id,
    name: category.name,
    slug: category.slug,
    desc: category.desc,
    postCount: category.post_count ?? 0,
  }
}
