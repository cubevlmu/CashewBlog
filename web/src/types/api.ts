export interface ApiResponse<T> {
  status?: number
  code?: number
  message?: string
  data: T
}

export interface ApiPageData<T> {
  list: T[]
  page: number
  page_size: number
  total: number
}

export type UserState = 'registered' | 'verified' | 'banned' | 'deleted'
export type UserRole = 'user' | 'admin' | 'super_admin'
export type Gender = 'unknown' | 'male' | 'female' | 'other'
export type BlogState = 'draft' | 'pending' | 'public' | 'private' | 'deleted'
export type CommentState = 'normal' | 'hidden' | 'deleted'
export type AssetState = 'normal' | 'hidden' | 'deleted'
export type SettingType = 'bool' | 'int' | 'string' | 'json'

export interface ApiAssetRef {
  id: number
  url?: string
}

export type ApiAssetValue = ApiAssetRef | ApiAssetItem | number

export interface ApiUserSummary {
  id: number
  username: string
  nickname: string
  avatar?: ApiAssetValue | null
  gender?: Gender
  bio?: string
  website?: string
  role?: UserRole
}

export interface ApiUserProfile extends ApiUserSummary {
  state: UserState
  role: UserRole
  email: string
  register_date: string
  last_login?: string | null
  email_verified: boolean
  created_at: string
  updated_at: string
}

export interface ApiTagItem {
  id: number
  name: string
  slug: string
  desc?: string
  color?: string
  post_count?: number
  created_at: string
}

export interface ApiCategoryParent {
  id: number
  name: string
  slug: string
}

export interface ApiCategoryItem {
  id: number
  name: string
  slug: string
  parent?: ApiCategoryParent | null
  desc?: string
  post_count?: number
  created_at: string
}

export interface ApiAssetItem {
  id: number
  file_name: string
  original_file_name: string
  mime_type: string
  file_extension: string
  url?: string
  file_hash: string
  file_size: number
  width?: number
  height?: number
  uploader?: ApiUserSummary | null
  state: AssetState
  created_at: string
  updated_at: string
}

export interface ApiBlogListItem {
  id: number
  state: BlogState
  title: string
  slug: string
  summary: string
  title_image?: ApiAssetRef | null
  author?: ApiUserSummary | null
  category?: ApiCategoryParent | null
  tags: ApiTagItem[]
  allow_comment: boolean
  is_top: boolean
  view_count: number
  like_count: number
  comment_count: number
  created_at: string
  updated_at: string
  published_at?: string | null
}

export interface ApiBlogDetail extends ApiBlogListItem {
  content_markdown: string
  category?: ApiCategoryItem | null
}

export interface ApiCommentItem {
  id: number
  blog_id: number
  parent_id: number
  content: string
  state: CommentState
  user?: ApiUserSummary | null
  children: ApiCommentItem[]
  created_at: string
  updated_at: string
}

export interface ApiAdminCommentItem extends ApiCommentItem {
  blog?: {
    id: number
    title: string
    slug: string
  }
}

export interface ApiPublicSettings {
  site: {
    title: string
    subtitle: string
    logo: string
    icp: string
    theme: string
  }
  home: {
    banner_title: string
    banner_subtitle: string
    banner_image: string
    typing_animation: boolean
  }
  navbar?: {
    head_text?: string
    links?: Array<{
      text: string
      link: string
    }>
  }
  announcement?: {
    content?: string
  }
  intro?: {
    blog_name?: string
    hitokoto?: string
  }
  sidebar?: {
    custom_html?: string
  }
  owner?: {
    name?: string
    avatar?: string
    bio?: string
    links?: Array<{
      text: string
      link: string
      icon?: string
    }>
  }
  footer?: {
    text?: string
    extra_html?: string
  }
  summary?: {
    post_count?: number
    category_count?: number
    tag_count?: number
  }
}

export interface ApiLoginData {
  access_token: string
  refresh_token: string
  expires_in: number
  user: ApiUserSummary
}

export interface ApiRefreshData {
  access_token: string
  refresh_token: string
  expires_in: number
}

export interface ApiAuthMeData {
  user: ApiUserProfile
}

export interface ApiAuthStatusData {
  user_id: number
}

export interface ApiBlogContextData {
  blog: ApiBlogDetail
  comments: ApiCommentItem[]
  prev_blog?: ApiBlogListItem | null
  next_blog?: ApiBlogListItem | null
}

export interface ApiSearchResultItem {
  id: number
  title: string
  slug: string
  summary: string
  author?: ApiUserSummary | null
  category?: ApiCategoryParent | null
  tags: ApiTagItem[]
  published_at: string
}

export interface ApiSearchData {
  keyword: string
  list: ApiSearchResultItem[]
  page: number
  page_size: number
  total: number
}

export interface ApiAuthorBlogsData {
  user?: ApiUserSummary | null
  list: ApiBlogListItem[]
  page: number
  page_size: number
  total: number
}

export interface ApiDashboardData {
  blog_count: number
  user_count: number
  comment_count: number
  tag_count: number
  category_count: number
  asset_count: number
  today_views: number
  today_comments: number
  recent_posts?: ApiDashboardRecentPost[]
  recent_comments?: ApiDashboardRecentComment[]
}

export interface ApiDashboardRecentPost {
  title: string
  author: string
  time: string
}

export interface ApiDashboardRecentComment {
  content: string
  publisher: string
  time: string
}

export interface ApiSettingItem {
  key: string
  value: string
  type: SettingType
  group: string
  description?: string
}

export interface ApiSettingsRootData {
  root: string
  items: ApiSettingItem[]
}
