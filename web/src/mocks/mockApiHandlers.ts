import {
  approveMockAdminPosts,
  createMockAdminCategory,
  createMockAdminTag,
  createMockAdminUser,
  deleteMockAdminAssets,
  deleteMockAdminCategories,
  deleteMockAdminPosts,
  deleteMockAdminTags,
  deleteMockAdminUsers,
  getMockAdminAssetById,
  getMockAdminAssets,
  getMockAdminCategories,
  getMockAdminDashboardSummary,
  getMockAdminPostById,
  getMockAdminPosts,
  getMockAdminTags,
  getMockAdminUserById,
  getMockAdminUsers,
  patchMockAdminComments,
  patchMockAdminPosts,
  saveMockAdminPostEditorRecord,
  getMockAdminPostEditorRecord,
  setMockAdminPostsPinned,
  updateMockAdminCategory,
  updateMockAdminTag,
  updateMockAdminUser,
} from '@/mocks/admin'
import { getMockAccountsPreview, mockLogin, updateMockCurrentUserPassword, updateMockCurrentUserProfile } from '@/mocks/auth'
import { createMockComment, deleteMockComments, getMockArticleCommentsBySlug } from '@/mocks/comments'
import {
  getMockCategories,
  getMockHomeConfig,
  getMockHomePosts,
  getMockPostBySlug,
  getMockPostById,
  getMockPostsByAuthor,
  getMockPostsByCategory,
  getMockPostsByTag,
  getMockSearchPosts,
  getSiteTaxonomyCategories,
  getSiteTaxonomyTags,
  getMockTags,
  updateMockHomeConfig,
} from '@/mocks/site'
import { authState } from '@/stores/authStore'
import type { ApiAuthMeData, ApiBlogContextData, ApiBlogListItem, ApiLoginData, ApiPageData, BlogState, Gender, UserRole } from '@/types/api'
import type { PagedPostListResponse, SearchResponse } from '@/types/site'

import {
  adminAssetToApiAsset,
  adminCommentToApiComment,
  adminPostToApiBlogDetail,
  adminUserToApiProfile,
  articleCommentToApiComment,
  buildLoginData,
  buildUserProfileFromAuthUser,
  dashboardSummaryToApi,
  fail,
  findPublicPostById,
  getCurrentSession,
  getPathSegments,
  homeConfigToPublicSettings,
  homePostToApiBlogListItem,
  homePostToApiBlogDetail,
  mapCommentState,
  mapStateToAdminPostState,
  ok,
  parseBody,
  parsePage,
  parsePageSize,
  resolveAdminPostForPublic,
  taxonomyToApiCategoryItem,
  taxonomyToApiTagItem,
  toPageData,
} from './mockApiShared'
import type { MockApiRequest } from './mockApiShared'

export async function handleSettings({ url, method, options }: MockApiRequest) {
  if (method === 'GET' && url.pathname === '/api/v1/settings/public') {
    return ok(homeConfigToPublicSettings(await getMockHomeConfig()))
  }

  if (method === 'PATCH' && url.pathname === '/api/v1/admin/site/home') {
    const body = parseBody<{
      banner_title: string
      banner_subtitle: string
      banner_image: string
      typing_animation: boolean
    }>(options)
    const current = await getMockHomeConfig()
    await updateMockHomeConfig({
      ...current,
      header: {
        ...current.header,
        title: body.banner_title,
        subtitle: body.banner_subtitle,
        image: body.banner_image,
        animation: body.typing_animation,
      },
    })
    return ok(body)
  }

  return null
}

export async function handleAuth({ url, method, options }: MockApiRequest) {
  if (method === 'POST' && url.pathname === '/api/v1/auth/login') {
    const body = parseBody<{ username: string; password: string }>(options)
    return ok(buildLoginData(await mockLogin(body.username, body.password)) satisfies ApiLoginData)
  }

  if (method === 'GET' && (url.pathname === '/api/v1/auth/me' || url.pathname === '/api/v1/me')) {
    return ok({ user: buildUserProfileFromAuthUser(getCurrentSession().user) } satisfies ApiAuthMeData)
  }

  if (method === 'PATCH' && url.pathname === '/api/v1/users/me') {
    const body = parseBody<{ nickname?: string; email?: string; gender?: Gender; bio?: string }>(options)
    const session = getCurrentSession()
    const nextSession = await updateMockCurrentUserProfile(session.user.id, {
      displayName: body.nickname || session.user.displayName,
      email: body.email || session.user.email,
      avatar: session.user.avatar,
      bio: body.bio || session.user.bio,
      gender: body.gender === 'male' || body.gender === 'female' ? body.gender : 'unknown',
      role: session.user.role,
    }, session.tokens)

    return ok({ user: buildUserProfileFromAuthUser(nextSession.user) } satisfies ApiAuthMeData)
  }

  if (method === 'PATCH' && url.pathname === '/api/v1/users/me/password') {
    const body = parseBody<{ current_password: string; next_password: string }>(options)
    const session = getCurrentSession()
    await updateMockCurrentUserPassword(session.user.id, body.current_password, body.next_password)
    return ok({ updated: true })
  }

  if (method === 'GET' && url.pathname === '/api/v1/mock/accounts') {
    return ok({ list: getMockAccountsPreview() })
  }

  return null
}

export async function handlePublicBlogs({ url, method, options }: MockApiRequest) {
  if (method === 'GET' && url.pathname === '/api/v1/home/posts') {
    const page = parsePage(url.searchParams)
    const pageSize = parsePageSize(url.searchParams)
    const home = await getMockHomePosts(1, 1000)
    const source = [...home.pinned, ...home.list]
    const pageData = toPageData(source, page, pageSize)
    const list = await Promise.all(pageData.list.map(async (post) => homePostToApiBlogListItem(post, await resolveAdminPostForPublic(post))))
    return ok({
      list,
      page,
      page_size: pageSize,
      total: source.length,
    })
  }

  if (method === 'GET' && url.pathname === '/api/v1/search') {
    const page = parsePage(url.searchParams)
    const pageSize = parsePageSize(url.searchParams)
    const keyword = url.searchParams.get('q') || ''
    const data = await getMockSearchPosts(keyword, page, pageSize)

    return ok({
      keyword,
      list: data.list.map((post) => ({
        id: post.id,
        title: post.title,
        slug: post.slug,
        summary: post.desc,
        author: null,
        category: {
          id: post.category.id,
          name: post.category.name,
          slug: post.category.slug,
        },
        tags: post.tags.map((tag) => ({
          id: tag.id,
          name: tag.name,
          slug: tag.slug,
          created_at: '2026-03-01T10:00:00Z',
        })),
        published_at: post.publishedAt,
      })),
      page,
      page_size: pageSize,
      total: data.total,
    })
  }

  if (method === 'GET' && url.pathname === '/api/v1/blogs') {
    const page = parsePage(url.searchParams)
    const pageSize = parsePageSize(url.searchParams)
    const keyword = url.searchParams.get('keyword') || ''
    const tagId = url.searchParams.get('tag_id')
    const categoryId = url.searchParams.get('category_id')
    const authorId = url.searchParams.get('author_id')

    let source: SearchResponse | PagedPostListResponse
    if (keyword) {
      source = await getMockSearchPosts(keyword, 1, 1000)
    } else if (tagId) {
      const tag = (await getMockTags('')).find((item) => item.id === Number(tagId))
      source = tag ? await getMockPostsByTag(tag.slug, 1, 1000) : { list: [], page: 1, pageSize: 1000, total: 0 }
    } else if (categoryId) {
      const category = (await getMockCategories('')).find((item) => item.id === Number(categoryId))
      source = category ? await getMockPostsByCategory(category.slug, 1, 1000) : { list: [], page: 1, pageSize: 1000, total: 0 }
    } else if (authorId) {
      const user = (await getMockAdminUsers()).find((item) => item.id === Number(authorId))
      source = user ? await getMockPostsByAuthor(user.username, 1, 1000) : { list: [], page: 1, pageSize: 1000, total: 0 }
    } else {
      const home = await getMockHomePosts(1, 1000)
      source = { list: [...home.pinned, ...home.list], page: 1, pageSize: 1000, total: home.pinned.length + home.list.length }
    }

    const pageData = toPageData(source.list, page, pageSize)
    const list = await Promise.all(pageData.list.map(async (post) => homePostToApiBlogListItem(post, await resolveAdminPostForPublic(post))))
    return ok({
      list,
      page,
      page_size: pageSize,
      total: source.total,
    } satisfies ApiPageData<ApiBlogListItem>)
  }

  if (method === 'GET' && url.pathname.startsWith('/api/v1/blogs/slug/')) {
    const parts = getPathSegments(url.pathname)
    const slug = decodeURIComponent(parts[4] || '')
    const post = await getMockPostBySlug(slug)
    if (!post) {
      fail('文章不存在')
    }

    if (parts[5] === 'context') {
      const comments = getMockArticleCommentsBySlug(slug).map((comment) => articleCommentToApiComment(comment, post.id))
      const all = await getMockSearchPosts('', 1, 1000)
      const index = all.list.findIndex((item) => item.slug === slug)
      const prev = index > 0 ? all.list[index - 1] : null
      const next = index >= 0 && index < all.list.length - 1 ? all.list[index + 1] : null
      const adminPost = await resolveAdminPostForPublic(post)
      return ok({
        blog: homePostToApiBlogDetail(post, adminPost),
        comments,
        prev_blog: prev ? homePostToApiBlogListItem(prev) : null,
        next_blog: next ? homePostToApiBlogListItem(next) : null,
      } satisfies ApiBlogContextData)
    }

    const adminPost = await resolveAdminPostForPublic(post)
    return ok({
      blog: homePostToApiBlogDetail(post, adminPost),
    })
  }

  const contextByIdMatch = url.pathname.match(/^\/api\/v1\/blogs\/(\d+)\/context$/)
  if (method === 'GET' && contextByIdMatch) {
    const blogId = Number(contextByIdMatch[1])
    const post = await getMockPostById(blogId)
    if (!post) {
      fail('文章不存在')
    }

    const comments = getMockArticleCommentsBySlug(post.slug).map((comment) => articleCommentToApiComment(comment, post.id))
    const all = await getMockSearchPosts('', 1, 1000)
    const index = all.list.findIndex((item) => item.id === blogId)
    const prev = index > 0 ? all.list[index - 1] : null
    const next = index >= 0 && index < all.list.length - 1 ? all.list[index + 1] : null
    const adminPost = await resolveAdminPostForPublic(post)

    return ok({
      blog: homePostToApiBlogDetail(post, adminPost),
      comments,
      prev_blog: prev ? homePostToApiBlogListItem(prev) : null,
      next_blog: next ? homePostToApiBlogListItem(next) : null,
    } satisfies ApiBlogContextData)
  }

  const detailMatch = url.pathname.match(/^\/api\/v1\/blogs\/(\d+)$/)
  if (method === 'GET' && detailMatch) {
    const post = await getMockAdminPostById(Number(detailMatch[1]))
    if (!post) {
      fail('文章不存在')
    }

    return ok({ blog: adminPostToApiBlogDetail(post) })
  }

  const commentsMatch = url.pathname.match(/^\/api\/v1\/blogs\/(\d+)\/comments$/)
  if (commentsMatch) {
    const blogId = Number(commentsMatch[1])
    const post = await findPublicPostById(blogId)
    const adminPost = post ? null : await getMockAdminPostById(blogId)
    const resolvedPost = post ?? (adminPost
      ? {
          id: adminPost.id,
          title: adminPost.title,
          slug: adminPost.slug,
        }
      : null)
    if (!resolvedPost) {
      fail('文章不存在')
    }

    if (method === 'GET') {
      const page = parsePage(url.searchParams)
      const pageSize = parsePageSize(url.searchParams)
      const list = getMockArticleCommentsBySlug(resolvedPost.slug).map((comment) => articleCommentToApiComment(comment, blogId))
      return ok(toPageData(list, page, pageSize))
    }

    if (method === 'POST') {
      const body = parseBody<{ content: string; parent_id?: number }>(options)
      const user = authState.user
      if (!user) {
        fail('请先登录后再评论')
      }

      const created = createMockComment({
        blogSlug: resolvedPost.slug,
        postTitle: resolvedPost.title,
        author: user.displayName,
        authorEmail: user.email,
        avatar: user.avatar,
        content: body.content,
        replyTo: body.parent_id ? `comment-${body.parent_id}` : undefined,
      })

      return ok({ comment: adminCommentToApiComment(created, blogId) })
    }
  }

  return null
}

export async function handleWriteBlogs({ url, method, options }: MockApiRequest) {
  const meDetailMatch = url.pathname.match(/^\/api\/v1\/me\/blogs\/(\d+)$/)
  if (method === 'GET' && meDetailMatch) {
    const id = Number(meDetailMatch[1])
    const [post, record] = await Promise.all([
      getMockAdminPostById(id),
      getMockAdminPostEditorRecord(id),
    ])
    if (!post) {
      fail('文章不存在')
    }

    return ok({ blog: adminPostToApiBlogDetail(post, record) })
  }

  const publishMatch = url.pathname.match(/^\/api\/v1\/blogs\/(\d+)\/publish$/)
  if (method === 'POST' && publishMatch) {
    const id = Number(publishMatch[1])
    await approveMockAdminPosts([id])
    return ok({
      id,
      state: 'public',
      published_at: new Date().toISOString(),
    })
  }

  const updateMatch = url.pathname.match(/^\/api\/v1\/blogs\/(\d+)$/)
  if (method === 'PUT' && updateMatch) {
    const id = Number(updateMatch[1])
    const body = parseBody<{
      title: string
      slug: string
      summary: string
      content_markdown: string
      category_id: number
      tag_ids: number[]
      allow_comment: boolean
      is_top: boolean
      state: BlogState
    }>(options)
    const [categories, tags] = await Promise.all([getMockAdminCategories(), getMockAdminTags()])
    const record = await saveMockAdminPostEditorRecord({
      id,
      title: body.title,
      slug: body.slug,
      desc: body.summary,
      coverImage: '',
      category: categories.find((item) => item.id === body.category_id)?.name || '',
      tags: tags.filter((item) => body.tag_ids.includes(item.id)).map((item) => item.name),
      content: body.content_markdown,
      state: body.state === 'public' ? 'public' : 'private',
      allowComment: body.allow_comment,
    })
    await setMockAdminPostsPinned([id], body.is_top)
    const post = await getMockAdminPostById(record.id || id)
    if (!post) {
      fail('文章不存在')
    }

    return ok({ blog: adminPostToApiBlogDetail(post, record) })
  }

  if (method === 'POST' && url.pathname === '/api/v1/me/blogs') {
    const body = parseBody<{
      title: string
      slug: string
      summary: string
      content_markdown: string
      category_id: number
      tag_ids: number[]
      allow_comment: boolean
      is_top: boolean
      state: BlogState
    }>(options)
    const [categories, tags] = await Promise.all([getMockAdminCategories(), getMockAdminTags()])
    const record = await saveMockAdminPostEditorRecord({
      id: null,
      title: body.title,
      slug: body.slug,
      desc: body.summary,
      coverImage: '',
      category: categories.find((item) => item.id === body.category_id)?.name || '',
      tags: tags.filter((item) => body.tag_ids.includes(item.id)).map((item) => item.name),
      content: body.content_markdown,
      state: body.state === 'public' ? 'public' : 'private',
      allowComment: body.allow_comment,
    })
    await setMockAdminPostsPinned([record.id || 0], body.is_top)
    const post = await getMockAdminPostById(record.id || 0)
    if (!post) {
      fail('文章不存在')
    }

    return ok({ blog: adminPostToApiBlogDetail(post, record) })
  }

  const meUpdateMatch = url.pathname.match(/^\/api\/v1\/me\/blogs\/(\d+)$/)
  if (method === 'PUT' && meUpdateMatch) {
    const id = Number(meUpdateMatch[1])
    const body = parseBody<{
      title: string
      slug: string
      summary: string
      content_markdown: string
      category_id: number
      tag_ids: number[]
      allow_comment: boolean
      is_top: boolean
      state: BlogState
    }>(options)
    const [categories, tags] = await Promise.all([getMockAdminCategories(), getMockAdminTags()])
    const record = await saveMockAdminPostEditorRecord({
      id,
      title: body.title,
      slug: body.slug,
      desc: body.summary,
      coverImage: '',
      category: categories.find((item) => item.id === body.category_id)?.name || '',
      tags: tags.filter((item) => body.tag_ids.includes(item.id)).map((item) => item.name),
      content: body.content_markdown,
      state: body.state === 'public' ? 'public' : 'private',
      allowComment: body.allow_comment,
    })
    await setMockAdminPostsPinned([id], body.is_top)
    const post = await getMockAdminPostById(record.id || id)
    if (!post) {
      fail('文章不存在')
    }

    return ok({ blog: adminPostToApiBlogDetail(post, record) })
  }

  const meDeleteMatch = url.pathname.match(/^\/api\/v1\/me\/blogs\/(\d+)$/)
  if (method === 'DELETE' && meDeleteMatch) {
    const id = Number(meDeleteMatch[1])
    await deleteMockAdminPosts([id])
    return ok({ deleted: true, id })
  }

  return null
}

export async function handleTaxonomy({ url, method, options }: MockApiRequest) {
  if (method === 'GET' && url.pathname === '/api/v1/tags') {
    return ok(toPageData((await getMockTags(url.searchParams.get('keyword') || '')).map(taxonomyToApiTagItem), parsePage(url.searchParams), parsePageSize(url.searchParams)))
  }

  if (method === 'GET' && url.pathname === '/api/v1/categories') {
    return ok(toPageData((await getMockCategories(url.searchParams.get('keyword') || '')).map(taxonomyToApiCategoryItem), parsePage(url.searchParams), parsePageSize(url.searchParams)))
  }

  const tagBlogs = url.pathname.match(/^\/api\/v1\/tags\/slug\/([^/]+)\/blogs$/)
  if (method === 'GET' && tagBlogs) {
    const data = await getMockPostsByTag(decodeURIComponent(tagBlogs[1]), 1, 1000)
    const list = await Promise.all(data.list.map(async (post) => homePostToApiBlogListItem(post, await resolveAdminPostForPublic(post))))
    return ok(toPageData(list, parsePage(url.searchParams), parsePageSize(url.searchParams)))
  }

  const categoryBlogs = url.pathname.match(/^\/api\/v1\/categories\/slug\/([^/]+)\/blogs$/)
  if (method === 'GET' && categoryBlogs) {
    const data = await getMockPostsByCategory(decodeURIComponent(categoryBlogs[1]), 1, 1000)
    const list = await Promise.all(data.list.map(async (post) => homePostToApiBlogListItem(post, await resolveAdminPostForPublic(post))))
    return ok(toPageData(list, parsePage(url.searchParams), parsePageSize(url.searchParams)))
  }

  if (method === 'POST' && url.pathname === '/api/v1/tags') {
    const body = parseBody<{ name: string; slug: string; color?: string }>(options)
    const tag = await createMockAdminTag({ name: body.name, slug: body.slug, desc: '' })
    return ok({ tag: taxonomyToApiTagItem({ id: tag.id, name: tag.name, slug: tag.slug, desc: tag.desc, color: body.color, postCount: tag.postCount }) })
  }

  const tagMatch = url.pathname.match(/^\/api\/v1\/tags\/(\d+)$/)
  if (tagMatch) {
    const id = Number(tagMatch[1])
    if (method === 'PATCH') {
      const body = parseBody<{ name: string; slug: string; color?: string }>(options)
      const tag = await updateMockAdminTag(id, { name: body.name, slug: body.slug, desc: '' })
      if (!tag) {
        fail('标签不存在')
      }
      return ok({ tag: taxonomyToApiTagItem({ id: tag.id, name: tag.name, slug: tag.slug, desc: tag.desc, color: body.color, postCount: tag.postCount }) })
    }

    if (method === 'DELETE') {
      await deleteMockAdminTags([id])
      return ok({ deleted: true, id })
    }
  }

  if (method === 'POST' && url.pathname === '/api/v1/categories') {
    const body = parseBody<{ name: string; slug: string; parent_id: number; desc: string }>(options)
    const category = await createMockAdminCategory({ name: body.name, slug: body.slug, parentId: body.parent_id || null, desc: body.desc })
    return ok({ category: taxonomyToApiCategoryItem({ id: category.id, name: category.name, slug: category.slug, desc: category.desc, postCount: category.postCount }) })
  }

  const categoryMatch = url.pathname.match(/^\/api\/v1\/categories\/(\d+)$/)
  if (categoryMatch) {
    const id = Number(categoryMatch[1])
    if (method === 'PATCH') {
      const body = parseBody<{ name: string; slug: string; parent_id: number; desc: string }>(options)
      const category = await updateMockAdminCategory(id, { name: body.name, slug: body.slug, parentId: body.parent_id || null, desc: body.desc })
      if (!category) {
        fail('分类不存在')
      }
      return ok({ category: taxonomyToApiCategoryItem({ id: category.id, name: category.name, slug: category.slug, desc: category.desc, postCount: category.postCount }) })
    }

    if (method === 'DELETE') {
      await deleteMockAdminCategories([id])
      return ok({ deleted: true, id })
    }
  }

  return null
}

export async function handleUsers({ url, method, options }: MockApiRequest) {
  const authorBlogs = url.pathname.match(/^\/api\/v1\/users\/([^/]+)\/blogs$/)
  if (method === 'GET' && authorBlogs) {
    const username = decodeURIComponent(authorBlogs[1])
    const [data, users] = await Promise.all([
      getMockPostsByAuthor(username, 1, 1000),
      getMockAdminUsers(),
    ])
    const list = await Promise.all(data.list.map(async (post) => homePostToApiBlogListItem(post, await resolveAdminPostForPublic(post))))
    const page = parsePage(url.searchParams)
    const pageSize = parsePageSize(url.searchParams)
    const paged = toPageData(list, page, pageSize)
    const user = users.find((item) => item.username === username)

    return ok({
      user: user ? {
        id: user.id,
        username: user.username,
        nickname: user.displayName,
        avatar: {
          id: user.id,
          url: user.avatar,
        },
      } : null,
      list: paged.list,
      page: paged.page,
      page_size: paged.page_size,
      total: paged.total,
    })
  }

  if (method === 'GET' && url.pathname === '/api/v1/users') {
    return ok(toPageData((await getMockAdminUsers()).map(adminUserToApiProfile), parsePage(url.searchParams), parsePageSize(url.searchParams)))
  }

  if (method === 'POST' && url.pathname === '/api/v1/users') {
    const body = parseBody<{ username: string; nickname: string; email: string; role: UserRole; gender: Gender; bio: string }>(options)
    const user = await createMockAdminUser({
      username: body.username,
      displayName: body.nickname,
      email: body.email,
      role: body.role === 'admin' ? 'admin' : 'user',
      avatar: '/placeholder-avatar.svg',
      gender: body.gender === 'male' || body.gender === 'female' ? body.gender : 'unknown',
      bio: body.bio,
    })
    return ok({ user: adminUserToApiProfile(user) })
  }

  const detailMatch = url.pathname.match(/^\/api\/v1\/users\/(\d+)$/)
  if (detailMatch) {
    const id = Number(detailMatch[1])
    if (method === 'GET') {
      const user = await getMockAdminUserById(id)
      if (!user) {
        fail('用户不存在')
      }
      return ok({ user: adminUserToApiProfile(user) })
    }

    if (method === 'PATCH') {
      const body = parseBody<{ nickname: string; email: string; role: UserRole; gender: Gender; bio: string }>(options)
      const user = await updateMockAdminUser(id, {
        displayName: body.nickname,
        email: body.email,
        role: body.role === 'admin' ? 'admin' : 'user',
        avatar: '/placeholder-avatar.svg',
        gender: body.gender === 'male' || body.gender === 'female' ? body.gender : 'unknown',
        bio: body.bio,
      })
      if (!user) {
        fail('用户不存在')
      }
      return ok({ user: adminUserToApiProfile(user) })
    }

    if (method === 'DELETE') {
      await deleteMockAdminUsers([id])
      return ok({ deleted: true, id })
    }
  }

  return null
}

export async function handleAssets({ url, method }: MockApiRequest) {
  if (method === 'GET' && url.pathname === '/api/v1/assets') {
    return ok(toPageData((await getMockAdminAssets()).map(adminAssetToApiAsset), parsePage(url.searchParams), parsePageSize(url.searchParams)))
  }

  const detailMatch = url.pathname.match(/^\/api\/v1\/assets\/(\d+)$/)
  if (detailMatch) {
    const id = Number(detailMatch[1])
    if (method === 'GET') {
      const asset = await getMockAdminAssetById(id)
      if (!asset) {
        fail('素材不存在')
      }
      return ok({ asset: adminAssetToApiAsset(asset) })
    }

    if (method === 'DELETE') {
      await deleteMockAdminAssets([id])
      return ok({ deleted: true, id })
    }
  }

  return null
}

export async function handleComments({ url, method, options }: MockApiRequest) {
  const stateMatch = url.pathname.match(/^\/api\/v1\/comments\/(\d+)\/state$/)
  if (stateMatch && method === 'PATCH') {
    const id = Number(stateMatch[1])
    const body = parseBody<{ state: string }>(options)
    await patchMockAdminComments([id], mapCommentState(body.state))
    return ok({ id, state: body.state })
  }

  const deleteMatch = url.pathname.match(/^\/api\/v1\/comments\/(\d+)$/)
  if (deleteMatch && method === 'DELETE') {
    const id = Number(deleteMatch[1])
    deleteMockComments([id])
    return ok({ deleted: true, id })
  }

  return null
}

export async function handleAdmin({ url, method, options }: MockApiRequest) {
  if (method === 'GET' && url.pathname === '/api/v1/admin/dashboard') {
    return ok(dashboardSummaryToApi(await getMockAdminDashboardSummary()))
  }

  if (method === 'GET' && url.pathname === '/api/v1/admin/blogs') {
    const state = url.searchParams.get('state')
    const data = await getMockAdminPosts({
      page: parsePage(url.searchParams),
      pageSize: parsePageSize(url.searchParams),
      keyword: url.searchParams.get('keyword') || undefined,
      state: state ? mapStateToAdminPostState(state) : 'all',
    })
    const siteCategories = getSiteTaxonomyCategories()
    const siteTags = getSiteTaxonomyTags()
    const list = data.list.map((post) =>
      homePostToApiBlogListItem({
        id: post.id,
        title: post.title,
        slug: post.slug,
        coverImage: post.coverImage,
        desc: post.desc,
        content: '',
        publishedAt: post.publishedAt,
        viewCount: post.viewCount,
        commentCount: post.commentCount,
        wordCount: post.wordCount,
        readingTime: post.readingTime,
        category: (() => {
          const matched = siteCategories.find((item) => item.name === post.category)
          return matched
            ? { id: matched.id, name: matched.name, slug: matched.slug }
            : { id: 0, name: post.category, slug: post.category.toLowerCase().replace(/\s+/g, '-') }
        })(),
        tags: post.tags.map((tag, index) => {
          const matched = siteTags.find((item) => item.name === tag)
          return matched
            ? { id: matched.id, name: matched.name, slug: matched.slug }
            : { id: 1000 + index, name: tag, slug: tag.toLowerCase().replace(/\s+/g, '-') }
        }),
        isPinned: post.isPinned,
      }, post),
    )
    return ok({
      list,
      page: data.page,
      page_size: data.pageSize,
      total: data.total,
    } satisfies ApiPageData<ApiBlogListItem>)
  }

  const stateMatch = url.pathname.match(/^\/api\/v1\/admin\/blogs\/(\d+)\/state$/)
  if (stateMatch && method === 'PATCH') {
    const id = Number(stateMatch[1])
    const body = parseBody<{ state: string }>(options)
    await patchMockAdminPosts([id], mapStateToAdminPostState(body.state))
    return ok({ id, state: body.state })
  }

  return null
}
