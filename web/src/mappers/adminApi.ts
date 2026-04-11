import type {
  AdminAssetRecord,
  AdminCategoryRecord,
  AdminCommentRecord,
  AdminPostEditorRecord,
  AdminPostRecord,
  AdminTagRecord,
  AdminUserRecord,
} from '@/types/admin'
import type { AdminDashboardSummary } from '@/types/adminDashboard'
import type {
  ApiAssetItem,
  ApiBlogDetail,
  ApiBlogListItem,
  ApiCategoryItem,
  ApiCommentItem,
  ApiDashboardData,
  ApiTagItem,
  ApiUserProfile,
  ApiUserSummary,
  BlogState,
} from '@/types/api'

function fallbackAvatar() {
  return '/placeholder-avatar.svg'
}

function pickAvatar(user?: ApiUserSummary | null) {
  return user?.avatar?.url || fallbackAvatar()
}

function estimateWordCount(blog: Pick<ApiBlogListItem, 'summary'> & Partial<Pick<ApiBlogDetail, 'content_markdown'>>) {
  const text = blog.content_markdown || blog.summary || ''
  return text.trim().length
}

function estimateReadingTime(wordCount: number) {
  return Math.max(1, Math.ceil(wordCount / 300))
}

function mapBlogStateToAdminState(state: BlogState): AdminPostRecord['state'] {
  if (state === 'deleted') {
    return 'deleted'
  }

  if (state === 'public') {
    return 'public'
  }

  return 'private'
}

function mapPostAuthor(user?: ApiUserSummary | null): AdminPostRecord['author'] {
  return {
    id: user?.id ?? 0,
    username: user?.username ?? '',
    displayName: user?.nickname ?? user?.username ?? 'Unknown',
    avatar: pickAvatar(user),
  }
}

function formatFileSize(size: number) {
  if (size >= 1024 * 1024) {
    return `${(size / 1024 / 1024).toFixed(1)} MB`
  }

  if (size >= 1024) {
    return `${(size / 1024).toFixed(1)} KB`
  }

  return `${size} B`
}

export function mapBlogToAdminPostRecord(blog: ApiBlogListItem | ApiBlogDetail): AdminPostRecord {
  const wordCount = estimateWordCount(blog)

  return {
    id: blog.id,
    title: blog.title,
    slug: blog.slug,
    desc: blog.summary,
    author: mapPostAuthor(blog.author),
    category: blog.category?.name || '未分类',
    tags: blog.tags.map((tag) => tag.name),
    state: mapBlogStateToAdminState(blog.state),
    auditStatus: blog.state === 'public' ? 'approved' : 'pending',
    publishedAt: blog.published_at || blog.updated_at || blog.created_at,
    updatedAt: blog.updated_at,
    viewCount: blog.view_count,
    likeCount: blog.like_count,
    commentCount: blog.comment_count,
    wordCount,
    readingTime: estimateReadingTime(wordCount),
    coverImage: blog.title_image?.url || '',
    isPinned: blog.is_top,
  }
}

export function mapBlogToAdminEditorRecord(blog?: ApiBlogDetail | null): AdminPostEditorRecord {
  return {
    id: blog?.id ?? null,
    title: blog?.title ?? '',
    slug: blog?.slug ?? '',
    desc: blog?.summary ?? '',
    coverImage: blog?.title_image?.url ?? '',
    category: blog?.category?.name ?? '',
    tags: blog?.tags.map((tag) => tag.name) ?? [],
    content: blog?.content_markdown ?? '',
    state: blog?.state === 'public' ? 'public' : 'private',
    allowComment: blog?.allow_comment ?? true,
  }
}

export function mapTagToAdminTagRecord(tag: ApiTagItem): AdminTagRecord {
  return {
    id: tag.id,
    name: tag.name,
    slug: tag.slug,
    desc: '',
    postCount: tag.post_count ?? 0,
  }
}

export function mapCategoryToAdminCategoryRecord(category: ApiCategoryItem): AdminCategoryRecord {
  return {
    id: category.id,
    name: category.name,
    slug: category.slug,
    desc: category.desc || '',
    postCount: category.post_count ?? 0,
    parentId: category.parent?.id || null,
    parentName: category.parent?.name || '',
    level: category.parent?.id ? 2 : 1,
  }
}

export function mapCommentToAdminCommentRecord(comment: ApiCommentItem, blogTitle = ''): AdminCommentRecord {
  return {
    id: comment.id,
    author: comment.user?.nickname || comment.user?.username || '匿名用户',
    authorEmail: '',
    avatar: pickAvatar(comment.user),
    content: comment.content,
    replyTo: undefined,
    submittedAt: comment.created_at,
    state: comment.state === 'hidden' ? 'hidden' : comment.state === 'deleted' ? 'hidden' : 'approved',
    postTitle: blogTitle,
  }
}

export function mapAssetToAdminAssetRecord(asset: ApiAssetItem): AdminAssetRecord {
  return {
    id: asset.id,
    title: asset.original_file_name,
    fileName: asset.file_name,
    fileUrl: asset.url,
    thumbnailUrl: asset.url,
    mimeType: asset.mime_type,
    fileSizeLabel: formatFileSize(asset.file_size),
    author: mapPostAuthor(asset.uploader),
    uploadedTo: '',
    commentCount: 0,
    uploadedAt: asset.created_at,
    alt: asset.original_file_name,
    description: '',
  }
}

export function mapUserToAdminUserRecord(user: ApiUserProfile): AdminUserRecord {
  return {
    id: user.id,
    username: user.username,
    displayName: user.nickname || user.username,
    email: user.email,
    role: user.role === 'admin' || user.role === 'super_admin' ? 'admin' : 'user',
    postCount: 0,
    twoFactorEnabled: false,
    lastLoginAt: user.last_login || user.updated_at,
    avatar: pickAvatar(user),
    gender: user.gender === 'female' || user.gender === 'male' ? user.gender : 'unknown',
    bio: user.bio || '',
  }
}

export function mapDashboardToSummary(data: ApiDashboardData): AdminDashboardSummary {
  return {
    stats: [
      { label: '文章数', value: String(data.blog_count) },
      { label: '用户数', value: String(data.user_count) },
      { label: '评论数', value: String(data.comment_count) },
      { label: '标签数', value: String(data.tag_count) },
      { label: '分类数', value: String(data.category_count) },
      { label: '素材数', value: String(data.asset_count) },
      { label: '今日浏览', value: String(data.today_views) },
      { label: '今日评论', value: String(data.today_comments) },
    ],
    recentPosts: [],
    recentComments: [],
  }
}
