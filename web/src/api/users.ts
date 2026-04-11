import type { ApiAuthorBlogsData } from '@/types/api'

import { requestJson } from '@/data/core/http'

export function getAuthorBlogs(username: string, page = 1, pageSize = 10) {
  return requestJson<ApiAuthorBlogsData>(
    `/api/v1/users/${encodeURIComponent(username)}/blogs?page=${page}&page_size=${pageSize}`,
  )
}
