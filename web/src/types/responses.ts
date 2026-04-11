import type { ArticleContext, HomePostCard } from '@/types/content'

export interface HomePostsResponse {
  pinned: HomePostCard[]
  list: HomePostCard[]
  page: number
  pageSize: number
  hasMore: boolean
}

export interface SearchResponse {
  keyword: string
  list: HomePostCard[]
  page: number
  pageSize: number
  total: number
}

export interface PagedPostListResponse {
  list: HomePostCard[]
  page: number
  pageSize: number
  total: number
}

export interface ArticleDetailResponse {
  post: HomePostCard | null
  context: ArticleContext
}
