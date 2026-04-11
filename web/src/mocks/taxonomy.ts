import type { AdminCategoryRecord, AdminTagRecord } from '@/types/admin'
import type { TaxonomyItem } from '@/types/site'

type TaxonomyTagSeed = {
  id: number
  name: string
  slug: string
  color?: string
  desc?: string
}

type TaxonomyCategorySeed = {
  id: number
  name: string
  slug: string
  desc?: string
  isDefault?: boolean
}

const taxonomyTagSeeds: TaxonomyTagSeed[] = [
  { id: 1, name: 'Vue', slug: 'vue', color: '#42b883' },
  { id: 2, name: 'TypeScript', slug: 'typescript', color: '#3178c6' },
  { id: 3, name: 'Design', slug: 'design', color: '#9b6b3f' },
  { id: 4, name: 'Performance', slug: 'performance', color: '#d97706' },
  { id: 5, name: 'Workflow', slug: 'workflow', color: '#7c3aed' },
  { id: 6, name: 'Life', slug: 'life', color: '#ef4444' },
]

const taxonomyCategorySeeds: TaxonomyCategorySeed[] = [
  { id: 1, name: '前端工程', slug: 'frontend' },
  { id: 2, name: '产品设计', slug: 'product-design' },
  { id: 3, name: '写作方法', slug: 'writing' },
  { id: 4, name: '生活记录', slug: 'life' },
  { id: 5, name: '未分类', slug: 'uncategorized', isDefault: true },
]

export function createInitialMockSiteTags(): TaxonomyItem[] {
  return taxonomyTagSeeds.map((tag) => ({
    ...tag,
    postCount: 0,
  }))
}

export function createInitialMockSiteCategories(): TaxonomyItem[] {
  return taxonomyCategorySeeds.map((category) => ({
    id: category.id,
    name: category.name,
    slug: category.slug,
    desc: category.desc,
    postCount: 0,
  }))
}

export function createInitialMockAdminTags(): AdminTagRecord[] {
  return taxonomyTagSeeds.map((tag) => ({
    id: tag.id,
    name: tag.name,
    slug: tag.slug,
    desc: tag.desc ?? '',
    postCount: 0,
  }))
}

export function createInitialMockAdminCategories(): AdminCategoryRecord[] {
  return taxonomyCategorySeeds.map((category) => ({
    id: category.id,
    name: category.name,
    slug: category.slug,
    desc: category.desc ?? '',
    postCount: 0,
    parentId: null,
    level: 0,
    isDefault: category.isDefault,
  }))
}
