import type { ApiSearchData } from '@/types/api'

import { requestJson } from '@/data/core/http'

export function searchBlogs(keyword: string, page = 1, pageSize = 10) {
  return requestJson<ApiSearchData>(
    `/api/v1/search?q=${encodeURIComponent(keyword)}&page=${page}&page_size=${pageSize}`,
  )
}
