import { mapCommentToAdminCommentRecord } from '@/mappers/adminApi'
import { requestJson } from '@/data/core/http'
import type { AdminCommentRecord } from '@/types/admin'
import type { ApiAdminCommentItem, ApiPageData } from '@/types/api'

export async function getAdminComments() {
  const data = await requestJson<ApiPageData<ApiAdminCommentItem>>('/api/v1/admin/comments?page=1&page_size=100')
  const commentsById = new Map(data.list.map((comment) => [comment.id, comment]))

  return data.list.map((comment) => {
    const parent = comment.parent_id ? commentsById.get(comment.parent_id) : null
    const replyTo = parent
      ? parent.user?.nickname || parent.user?.username || `评论 #${parent.id}`
      : comment.parent_id
        ? `评论 #${comment.parent_id}`
        : undefined

    return mapCommentToAdminCommentRecord(comment, comment.blog?.title || '', replyTo)
  })
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
