import { mapCommentToAdminCommentRecord } from '@/mappers/adminApi'
import { requestJson } from '@/data/core/http'
import type { AdminCommentRecord } from '@/types/admin'
import type { ApiBlogListItem, ApiCommentItem, ApiPageData } from '@/types/api'

export async function getAdminComments() {
  const blogs = await requestJson<ApiPageData<ApiBlogListItem>>('/api/v1/admin/blogs?page=1&page_size=100')
  const commentGroups = await Promise.all(
    blogs.list.map(async (blog) => {
      const data = await requestJson<ApiPageData<ApiCommentItem>>(`/api/v1/blogs/${blog.id}/comments?page=1&page_size=100`)
      return data.list.map((comment) => mapCommentToAdminCommentRecord(comment, blog.title))
    }),
  )

  return commentGroups.flat()
}

export async function updateAdminCommentsState(ids: number[], state: AdminCommentRecord['state']) {
  await Promise.all(
    ids.map((id) =>
      requestJson(`/api/v1/comments/${id}/state`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          state: state === 'hidden' ? 'hidden' : 'normal',
        }),
      }),
    ),
  )
}

export async function deleteAdminComments(ids: number[]) {
  await Promise.all(ids.map((id) => requestJson<void>(`/api/v1/comments/${id}`, { method: 'DELETE' })))
}
