import type { ApiBlogContextData, ApiBlogListItem, ApiPageData } from '@/types/api'

import { requestJson } from '@/data/core/http'

export function getHomePosts(page = 1, pageSize = 20) {
  return requestJson<ApiPageData<ApiBlogListItem>>(`/api/v1/home/posts?page=${page}&page_size=${pageSize}`)
}

export function getBlogContextBySlug(slug: string) {
  return requestJson<ApiBlogContextData>(`/api/v1/blogs/slug/${encodeURIComponent(slug)}/context`)
}

export function getBlogContextById(id: number) {
  return requestJson<ApiBlogContextData>(`/api/v1/blogs/${id}/context`)
}
