import type { ApiBlogDetail } from '@/types/api'
import type { EditorForm } from '@/types/forms'

import { requestJson } from '@/data/core/http'
import { authState } from '@/stores/authStore'

export function getMyBlogDetail(id: number) {
  return requestJson<{ blog: ApiBlogDetail }>(`/api/v1/me/blogs/${id}`)
}

export async function getEditableBlogDetail(id: number) {
  if (authState.isAdmin) {
    try {
      return await requestJson<{ blog: ApiBlogDetail }>(`/api/v1/admin/blogs/${id}`)
    } catch {}
  }

  try {
    return await requestJson<{ blog: ApiBlogDetail }>(`/api/v1/me/blogs/${id}`)
  } catch {
    return requestJson<{ blog: ApiBlogDetail }>(`/api/v1/blogs/${id}`)
  }
}

function editorPayload(payload: EditorForm) {
  return {
    title: payload.title,
    slug: payload.slug,
    summary: payload.summary,
    content_markdown: payload.contentMarkdown,
    title_image_id: payload.titleImageId ?? null,
    category_id: payload.categoryId ?? null,
    tag_ids: payload.tagIds,
    allow_comment: payload.allowComment,
    is_top: payload.isTop,
    state: payload.state,
  }
}

export function createMyBlog(payload: EditorForm) {
  return requestJson<{ blog: ApiBlogDetail }>('/api/v1/me/blogs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(editorPayload(payload)),
  })
}

export function updateMyBlog(id: number, payload: EditorForm) {
  return requestJson<{ blog: ApiBlogDetail }>(authState.isAdmin ? `/api/v1/blogs/${id}` : `/api/v1/me/blogs/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(editorPayload(payload)),
  })
}
