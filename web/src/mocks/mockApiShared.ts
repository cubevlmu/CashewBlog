import { getMockAdminDashboardSummary, getMockAdminPostById } from '@/mocks/admin'
import { getMockSearchPosts, getSiteTaxonomyCategories, getSiteTaxonomyTags } from '@/mocks/site'
import { authState, getAuthSession } from '@/stores/authStore'
import type {
  ApiAssetItem,
  ApiBlogDetail,
  ApiBlogListItem,
  ApiCategoryItem,
  ApiCommentItem,
  ApiDashboardData,
  ApiPageData,
  ApiPublicSettings,
  ApiTagItem,
  ApiUserProfile,
  ApiUserSummary,
  AssetState,
  CommentState,
  Gender,
  UserRole,
  UserState,
} from '@/types/api'
import type { AdminAssetRecord, AdminCommentRecord, AdminPostEditorRecord, AdminPostRecord, AdminUserRecord } from '@/types/admin'
import type { AuthSession, AuthUser } from '@/types/auth'
import type { ArticleComment, HomeConfig, HomePostCard, TaxonomyItem } from '@/types/site'

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

export interface MockApiRequest {
  url: URL
  method: HttpMethod
  options?: RequestInit
}

export function delay<T>(value: T, timeout = 180): Promise<T> {
  return new Promise((resolve) => {
    window.setTimeout(() => resolve(value), timeout)
  })
}

export function ok<T>(data: T) {
  return delay(data)
}

export function fail(message: string): never {
  throw new Error(message)
}

export function parseUrl(path: string) {
  return new URL(path, 'http://mock.local')
}

export function parseBody<T>(options?: RequestInit): T {
  if (!options?.body || typeof options.body !== 'string') {
    return {} as T
  }

  return JSON.parse(options.body) as T
}

export function getMethod(options?: RequestInit): HttpMethod {
  return (options?.method?.toUpperCase() || 'GET') as HttpMethod
}

export function getPathSegments(pathname: string) {
  return pathname.split('/').filter(Boolean)
}

export function parsePage(searchParams: URLSearchParams) {
  return Number(searchParams.get('page') || '1')
}

export function parsePageSize(searchParams: URLSearchParams) {
  return Number(searchParams.get('page_size') || '10')
}

export function toPageData<T>(list: T[], page: number, pageSize: number): ApiPageData<T> {
  const start = (page - 1) * pageSize

  return {
    list: list.slice(start, start + pageSize),
    page,
    page_size: pageSize,
    total: list.length,
  }
}

export function roleToApi(role: AuthUser['role'] | AdminUserRecord['role']): UserRole {
  return role === 'admin' ? 'admin' : 'user'
}

export function genderToApi(gender: AuthUser['gender'] | AdminUserRecord['gender']): Gender {
  return gender === 'male' || gender === 'female' ? gender : 'unknown'
}

export function buildUserSummaryFromAuthUser(user: AuthUser): ApiUserSummary {
  return {
    id: user.id,
    username: user.username,
    nickname: user.displayName,
    avatar: {
      id: user.id,
      url: user.avatar,
    },
    gender: genderToApi(user.gender),
    bio: user.bio,
    role: roleToApi(user.role),
  }
}

export function buildUserProfileFromAuthUser(user: AuthUser): ApiUserProfile {
  const now = new Date().toISOString()

  return {
    ...buildUserSummaryFromAuthUser(user),
    state: 'verified',
    role: roleToApi(user.role),
    email: user.email,
    website: '',
    register_date: now,
    last_login: now,
    email_verified: true,
    created_at: now,
    updated_at: now,
  }
}

export function buildLoginData(session: AuthSession) {
  return {
    access_token: session.tokens.token,
    refresh_token: session.tokens.refreshToken,
    expires_in: 7200,
    user: buildUserSummaryFromAuthUser(session.user),
  }
}

export function getCurrentSession(): AuthSession {
  const session = getAuthSession()
  if (!session) {
    fail('当前未登录')
  }

  return session
}

export function taxonomyToApiTagItem(item: TaxonomyItem): ApiTagItem {
  return {
    id: item.id,
    name: item.name,
    slug: item.slug,
    color: item.color,
    post_count: item.postCount,
    created_at: '2026-03-01T10:00:00Z',
  }
}

export function taxonomyToApiCategoryItem(item: TaxonomyItem): ApiCategoryItem {
  return {
    id: item.id,
    name: item.name,
    slug: item.slug,
    parent: {
      id: 0,
      name: '',
      slug: '',
    },
    desc: item.desc,
    post_count: item.postCount,
    created_at: '2026-03-01T10:00:00Z',
  }
}

export function homeConfigToPublicSettings(config: HomeConfig): ApiPublicSettings {
  return {
    site: {
      title: config.navbar.headText,
      subtitle: config.announcement,
      logo: config.owner.avatar,
      icp: config.footer.text,
      theme: 'light',
    },
    home: {
      banner_title: config.header.title,
      banner_subtitle: config.header.subtitle,
      banner_image: config.header.image,
      typing_animation: config.header.animation,
    },
    navbar: {
      head_text: config.navbar.headText,
      links: config.navbar.links.map((link) => ({ ...link })),
    },
    intro: {
      blog_name: config.intro.blogName,
      hitokoto: config.intro.hitokoto,
    },
    sidebar: {
      custom_html: config.sidebar.customHtml,
    },
    owner: {
      name: config.owner.name,
      avatar: config.owner.avatar,
      bio: config.owner.bio,
      links: config.owner.links.map((link) => ({ ...link })),
    },
    footer: {
      text: config.footer.text,
      extra_html: config.footer.extraHtml,
    },
    summary: {
      post_count: config.summary.postCount,
      category_count: config.summary.categoryCount,
      tag_count: config.summary.tagCount,
    },
  }
}

export function toApiAuthor(post: AdminPostRecord): ApiUserSummary {
  return {
    id: post.author.id,
    username: post.author.username,
    nickname: post.author.displayName,
    avatar: {
      id: post.author.id,
      url: post.author.avatar,
    },
    role: post.author.username === 'admin' ? 'admin' : 'user',
  }
}

function resolveApiCategory(categoryName: string) {
  const matched = getSiteTaxonomyCategories().find((item) => item.name === categoryName)
  if (matched) {
    return {
      id: matched.id,
      name: matched.name,
      slug: matched.slug,
    }
  }

  return {
    id: 0,
    name: categoryName,
    slug: categoryName.toLowerCase().replace(/\s+/g, '-'),
  }
}

function resolveApiTag(tagName: string, index = 0) {
  const matched = getSiteTaxonomyTags().find((item) => item.name === tagName)
  if (matched) {
    return {
      id: matched.id,
      name: matched.name,
      slug: matched.slug,
    }
  }

  return {
    id: 1000 + index,
    name: tagName,
    slug: tagName.toLowerCase().replace(/\s+/g, '-'),
  }
}

export function homePostToApiBlogListItem(post: HomePostCard, adminPost?: AdminPostRecord | null): ApiBlogListItem {
  return {
    id: post.id,
    state: 'public',
    title: post.title,
    slug: post.slug,
    summary: post.desc,
    title_image: {
      id: post.id,
      url: post.coverImage,
    },
    author: adminPost ? toApiAuthor(adminPost) : undefined,
    category: {
      id: post.category.id,
      name: post.category.name,
      slug: post.category.slug,
    },
    tags: post.tags.map((tag) => ({
      id: tag.id,
      name: tag.name,
      slug: tag.slug,
      color: undefined,
      created_at: '2026-03-01T10:00:00Z',
    })),
    allow_comment: true,
    is_top: post.isPinned,
    view_count: post.viewCount,
    like_count: adminPost?.likeCount ?? 0,
    comment_count: post.commentCount,
    created_at: post.publishedAt,
    updated_at: adminPost?.updatedAt ?? post.publishedAt,
    published_at: post.publishedAt,
  }
}

export function homePostToApiBlogDetail(post: HomePostCard, adminPost?: AdminPostRecord | null): ApiBlogDetail {
  const listItem = homePostToApiBlogListItem(post, adminPost)

  return {
    ...listItem,
    state: adminPost
      ? adminPost.state === 'public'
        ? 'public'
        : adminPost.state === 'deleted'
          ? 'deleted'
          : 'draft'
      : 'public',
    content_markdown: post.content || '',
    category: {
      id: post.category.id,
      name: post.category.name,
      slug: post.category.slug,
      parent: { id: 0, name: '', slug: '' },
      desc: '',
      created_at: post.publishedAt,
    },
  }
}

export function adminPostToApiBlogDetail(post: AdminPostRecord, editor?: AdminPostEditorRecord | null): ApiBlogDetail {
  const content = editor?.content || `# ${post.title}\n\n${post.desc}`
  const category = resolveApiCategory(post.category)
  const tags = post.tags.map((tag, index) => resolveApiTag(tag, index))

  return {
    ...homePostToApiBlogListItem({
      id: post.id,
      title: post.title,
      slug: post.slug,
      coverImage: post.coverImage,
      desc: post.desc,
      content,
      publishedAt: post.publishedAt,
      viewCount: post.viewCount,
      commentCount: post.commentCount,
      wordCount: post.wordCount,
      readingTime: post.readingTime,
      category,
      tags,
      isPinned: post.isPinned,
    }, post),
    state: post.state === 'public' ? 'public' : post.state === 'deleted' ? 'deleted' : 'draft',
    content_markdown: content,
    category: {
      id: category.id,
      name: category.name,
      slug: category.slug,
      parent: {
        id: 0,
        name: '',
        slug: '',
      },
      desc: '',
      created_at: post.publishedAt,
    },
  }
}

export function articleCommentToApiComment(comment: ArticleComment, blogId: number): ApiCommentItem {
  return {
    id: comment.id,
    blog_id: blogId,
    parent_id: 0,
    content: comment.content,
    state: 'normal',
    user: {
      id: comment.id,
      username: comment.author.toLowerCase().replace(/\s+/g, '-'),
      nickname: comment.author,
      avatar: {
        id: comment.id,
        url: comment.avatar,
      },
      role: 'user',
    },
    children: [],
    created_at: comment.createdAt,
    updated_at: comment.createdAt,
  }
}

export function adminCommentToApiComment(comment: AdminCommentRecord, blogId: number): ApiCommentItem {
  const state: CommentState = comment.state === 'hidden' ? 'hidden' : 'normal'

  return {
    id: comment.id,
    blog_id: blogId,
    parent_id: 0,
    content: comment.content,
    state,
    user: {
      id: comment.id,
      username: comment.author.toLowerCase().replace(/\s+/g, '-'),
      nickname: comment.author,
      avatar: {
        id: comment.id,
        url: comment.avatar,
      },
      role: 'user',
    },
    children: [],
    created_at: comment.submittedAt,
    updated_at: comment.submittedAt,
  }
}

export function adminAssetToApiAsset(asset: AdminAssetRecord): ApiAssetItem {
  const state: AssetState = 'normal'

  return {
    id: asset.id,
    file_name: asset.fileName,
    original_file_name: asset.title,
    mime_type: asset.mimeType,
    file_extension: asset.fileName.includes('.') ? `.${asset.fileName.split('.').pop()}` : '',
    url: asset.fileUrl,
    file_hash: `mock:${asset.id}`,
    file_size: Number.parseInt(asset.fileSizeLabel, 10) * 1024 || 0,
    width: 1200,
    height: 800,
    uploader: {
      id: asset.author.id,
      username: asset.author.username,
      nickname: asset.author.displayName,
      avatar: {
        id: asset.author.id,
        url: asset.author.avatar,
      },
      role: asset.author.username === 'admin' ? 'admin' : 'user',
    },
    state,
    created_at: asset.uploadedAt,
    updated_at: asset.uploadedAt,
  }
}

export function adminUserToApiProfile(user: AdminUserRecord): ApiUserProfile {
  const state: UserState = 'verified'

  return {
    id: user.id,
    username: user.username,
    nickname: user.displayName,
    avatar: {
      id: user.id,
      url: user.avatar,
    },
    gender: genderToApi(user.gender),
    bio: user.bio,
    website: '',
    role: roleToApi(user.role),
    state,
    email: user.email,
    register_date: user.lastLoginAt,
    last_login: user.lastLoginAt,
    email_verified: true,
    created_at: user.lastLoginAt,
    updated_at: user.lastLoginAt,
  }
}

export async function findPublicPostById(id: number) {
  const all = await getMockSearchPosts('', 1, 1000)
  return all.list.find((item) => item.id === id) ?? null
}

export async function resolveAdminPostForPublic(post: HomePostCard) {
  return getMockAdminPostById(post.id)
}

export function mapStateToAdminPostState(state: string): AdminPostRecord['state'] {
  if (state === 'deleted') return 'deleted'
  if (state === 'public') return 'public'
  if (state === 'archived') return 'archived'
  return 'private'
}

export function mapCommentState(state: string): AdminCommentRecord['state'] {
  return state === 'hidden' ? 'hidden' : 'approved'
}

export function dashboardSummaryToApi(summary: Awaited<ReturnType<typeof getMockAdminDashboardSummary>>): ApiDashboardData {
  const valueOf = (label: string) => Number(summary.stats.find((item) => item.label === label)?.value || 0)

  return {
    blog_count: valueOf('文章数'),
    user_count: authState.isAdmin ? 3 : 1,
    comment_count: valueOf('评论数'),
    tag_count: valueOf('标签数'),
    category_count: valueOf('分类数'),
    asset_count: valueOf('资源数'),
    today_views: 2500,
    today_comments: 18,
  }
}
