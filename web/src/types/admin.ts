export type AdminPostState = 'public' | 'private' | 'archived' | 'deleted'
export type AdminAuditStatus = 'approved' | 'pending'

export interface AdminPostAuthor {
  id: number
  username: string
  displayName: string
  avatar: string
}

export interface AdminPostRecord {
  id: number
  title: string
  slug: string
  desc: string
  author: AdminPostAuthor
  category: string
  tags: string[]
  state: AdminPostState
  auditStatus: AdminAuditStatus
  publishedAt: string
  updatedAt: string
  viewCount: number
  likeCount: number
  commentCount: number
  wordCount: number
  readingTime: number
  coverImage: string
  isPinned: boolean
}

export interface AdminPostEditorRecord {
  id: number | null
  title: string
  slug: string
  desc: string
  coverImage: string
  category: string
  tags: string[]
  content: string
  state: 'public' | 'private'
  allowComment: boolean
}

export interface AdminPostListParams {
  page: number
  pageSize: number
  keyword?: string
  state?: AdminPostState | 'all'
}

export interface AdminPostListResponse {
  list: AdminPostRecord[]
  total: number
  page: number
  pageSize: number
}

export interface AdminTagRecord {
  id: number
  name: string
  slug: string
  desc: string
  postCount: number
}

export interface AdminCategoryRecord {
  id: number
  name: string
  slug: string
  desc: string
  postCount: number
  parentId: number | null
  parentName?: string
  level: number
  isDefault?: boolean
}

export type AdminCommentState = 'approved' | 'pending' | 'hidden'

export interface AdminCommentRecord {
  id: number
  author: string
  authorEmail: string
  authorUrl?: string
  avatar: string
  content: string
  replyTo?: string
  submittedAt: string
  state: AdminCommentState
  postTitle: string
}

export interface AdminAssetRecord {
  id: number
  title: string
  fileName: string
  fileUrl: string
  thumbnailUrl: string
  mimeType: string
  fileSizeLabel: string
  author: AdminPostAuthor
  uploadedTo?: string
  commentCount: number
  uploadedAt: string
  alt?: string
  description?: string
}

export type AdminUserRole = 'admin' | 'editor' | 'user'

export interface AdminUserRecord {
  id: number
  username: string
  displayName: string
  email: string
  role: AdminUserRole
  postCount: number
  twoFactorEnabled: boolean
  lastLoginAt: string
  avatar: string
  avatarId: number | null
  gender: 'male' | 'female' | 'unknown'
  bio: string
  website: string
}

export interface AdminConfigLink {
  text: string
  link: string
  icon?: string
}

export interface AdminSiteSettings {
  siteTitle: string
  introBlogName: string
  introHitokoto: string
  announcement: string
  smtpHost: string
  smtpPort: string
  smtpUsername: string
  smtpPassword: string
  smtpFromName: string
  smtpFromEmail: string
  smtpEncryption: 'none' | 'ssl' | 'tls'
}

export interface AdminHomeConfigSettings {
  navbarHeadText: string
  navbarLinks: AdminConfigLink[]
  heroTitle: string
  heroSubtitle: string
  heroImage: string
  heroAnimation: boolean
  announcement: string
  sidebarCustomHtml: string
  ownerName: string
  ownerAvatar: string
  ownerBio: string
  ownerLinks: AdminConfigLink[]
  footerText: string
  footerExtraHtml: string
}
