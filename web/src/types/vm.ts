import type { ArticleContext, HomePostCard, TaxonomyItem } from '@/types/content'
import type { HomeConfig } from '@/types/site-config'

export type PostCardVM = HomePostCard
export type PostDetailVM = HomePostCard
export type TaxonomyItemVM = TaxonomyItem
export type SiteConfigVM = HomeConfig

export interface HomePageVM {
  config: SiteConfigVM
  tags: TaxonomyItemVM[]
  categories: TaxonomyItemVM[]
  pinnedPosts: PostCardVM[]
  posts: PostCardVM[]
  page: number
  hasMore: boolean
}

export interface PostContextVM {
  post: PostDetailVM | null
  context: ArticleContext
}

export interface SearchPageVM {
  keyword: string
  list: PostCardVM[]
  page: number
  pageSize: number
  total: number
}
