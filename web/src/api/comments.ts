import type { ApiCommentItem, ApiPageData } from '@/types/api'

import { requestJson } from '@/data/core/http'

export async function getBlogCommentsById(blogId: number) {
  return requestJson<ApiPageData<ApiCommentItem>>(`/api/v1/blogs/${blogId}/comments?page=1&page_size=100`)
}

export async function createBlogCommentById(blogId: number, content: string, parentId = 0) {
  return requestJson(`/api/v1/blogs/${blogId}/comments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      content,
      parent_id: parentId,
    }),
  })
}
