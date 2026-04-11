import type { ApiBlogListItem, ApiCategoryItem, ApiPageData, ApiTagItem } from '@/types/api'

import { requestJson } from '@/data/core/http'

export function getTags(page = 1, pageSize = 50, keyword = '') {
  return requestJson<ApiPageData<ApiTagItem>>(
    `/api/v1/tags?page=${page}&page_size=${pageSize}&keyword=${encodeURIComponent(keyword)}`,
  )
}

export function getCategories(page = 1, pageSize = 50, keyword = '') {
  return requestJson<ApiPageData<ApiCategoryItem>>(
    `/api/v1/categories?page=${page}&page_size=${pageSize}&keyword=${encodeURIComponent(keyword)}`,
  )
}

export function getTaxonomyBlogs(kind: 'tags' | 'categories', slug: string, page = 1, pageSize = 10) {
  return requestJson<ApiPageData<ApiBlogListItem>>(
    `/api/v1/${kind}/slug/${encodeURIComponent(slug)}/blogs?page=${page}&page_size=${pageSize}`,
  )
}
