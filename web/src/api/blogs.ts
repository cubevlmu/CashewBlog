import type { ApiBlogContextData, ApiBlogDetail, ApiBlogListItem, ApiCommentItem, ApiPageData } from '@/types/api'

import { requestJson } from '@/data/core/http'

export function getHomePosts(page = 1, pageSize = 20) {
  return requestJson<ApiPageData<ApiBlogListItem>>(`/api/v1/home/posts?page=${page}&page_size=${pageSize}`)
}

export function getBlogContextBySlug(slug: string) {
  return requestJson<ApiBlogContextData>(`/api/v1/blogs/slug/${encodeURIComponent(slug)}/context`)
}

export function getBlogContextById(id: number) {
  return Promise.all([
    requestJson<{ blog: ApiBlogDetail }>(`/api/v1/blogs/${id}`),
    requestJson<ApiPageData<ApiCommentItem>>(`/api/v1/blogs/${id}/comments?page=1&page_size=100`),
  ]).then(([blogData, commentsData]) => ({
    blog: blogData.blog,
    comments: commentsData.list,
    prev_blog: null,
    next_blog: null,
  }))
}
