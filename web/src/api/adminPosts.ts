import { mapBlogToAdminPostRecord } from '@/mappers/adminApi'
import { requestJson } from '@/data/core/http'
import { authState } from '@/stores/authStore'
import type { AdminPostListParams, AdminPostListResponse, AdminPostState } from '@/types/admin'
import type { ApiBlogDetail, ApiBlogListItem, ApiPageData } from '@/types/api'

async function getAdminPostDetail(id: number) {
  if (authState.isAdmin) {
    try {
      const data = await requestJson<{ blog: ApiBlogDetail }>(`/api/v1/admin/blogs/${id}`)
      return data.blog
    } catch {}
  }
  try {
    const data = await requestJson<{ blog: ApiBlogDetail }>(`/api/v1/me/blogs/${id}`)
    return data.blog
  } catch {
    const data = await requestJson<{ blog: ApiBlogDetail }>(`/api/v1/blogs/${id}`)
    return data.blog
  }
}

export async function getAdminPosts(params: AdminPostListParams): Promise<AdminPostListResponse> {
  const query = new URLSearchParams({
    page: String(params.page),
    page_size: String(params.pageSize),
  })

  if (params.keyword) {
    query.set('keyword', params.keyword)
  }

  if (params.state && params.state !== 'all') {
    query.set('state', params.state)
  }

  const path = authState.isAdmin ? '/api/v1/admin/blogs' : '/api/v1/me/blogs'
  const data = await requestJson<ApiPageData<ApiBlogListItem>>(`${path}?${query.toString()}`)

  return {
    list: data.list.map(mapBlogToAdminPostRecord),
    total: data.total,
    page: data.page,
    pageSize: data.page_size,
  }
}

export async function getAdminPostById(id: number) {
  const blog = await getAdminPostDetail(id)
  return mapBlogToAdminPostRecord(blog)
}

export async function updateAdminPostState(ids: number[], nextState: AdminPostState) {
  if (nextState === 'deleted') {
    await Promise.all(
      ids.map(async (id) => {
        try {
          await requestJson(`/api/v1/me/blogs/${id}`, {
            method: 'DELETE',
          })
        } catch {
          await requestJson(`/api/v1/admin/blogs/${id}/state`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              state: 'deleted',
            }),
          })
        }
      }),
    )
    return
  }

  await Promise.all(
    ids.map((id) =>
      requestJson(`/api/v1/admin/blogs/${id}/state`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          state: nextState === 'public' ? 'public' : 'private',
        }),
      }),
    ),
  )
}

export async function approveAdminPosts(ids: number[]) {
  await Promise.all(
    ids.map((id) =>
      requestJson(`/api/v1/blogs/${id}/publish`, {
        method: 'POST',
      }),
    ),
  )
}

export async function setAdminPostsPinned(ids: number[], isPinned: boolean) {
  await Promise.all(
    ids.map(async (id) => {
      const blog = await getAdminPostDetail(id)
      const payload = {
        title: blog.title,
        slug: blog.slug,
        summary: blog.summary,
        content_markdown: blog.content_markdown,
        title_image_id: blog.title_image?.id ?? null,
        category_id: blog.category?.id ?? null,
        tag_ids: blog.tags.map((tag) => tag.id),
        allow_comment: blog.allow_comment,
        is_top: isPinned,
        state: blog.state,
      }

      try {
        await requestJson(`/api/v1/me/blogs/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
      } catch {
        await requestJson(`/api/v1/blogs/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
      }
    }),
  )
}
