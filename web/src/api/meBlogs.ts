import type { ApiBlogDetail } from '@/types/api'
import type { EditorForm } from '@/types/forms'

import { requestJson } from '@/data/core/http'

export function getMyBlogDetail(id: number) {
  return requestJson<{ blog: ApiBlogDetail }>(`/api/v1/me/blogs/${id}`)
}

export function createMyBlog(payload: EditorForm) {
  return requestJson<{ blog: ApiBlogDetail }>('/api/v1/me/blogs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: payload.title,
      slug: payload.slug,
      summary: payload.summary,
      content_markdown: payload.contentMarkdown,
      title_image_id: payload.titleImageId ?? 0,
      category_id: payload.categoryId ?? 0,
      tag_ids: payload.tagIds,
      allow_comment: payload.allowComment,
      is_top: payload.isTop,
      state: payload.state,
    }),
  })
}

export function updateMyBlog(id: number, payload: EditorForm) {
  return requestJson<{ blog: ApiBlogDetail }>(`/api/v1/me/blogs/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: payload.title,
      slug: payload.slug,
      summary: payload.summary,
      content_markdown: payload.contentMarkdown,
      title_image_id: payload.titleImageId ?? 0,
      category_id: payload.categoryId ?? 0,
      tag_ids: payload.tagIds,
      allow_comment: payload.allowComment,
      is_top: payload.isTop,
      state: payload.state,
    }),
  })
}
