export interface TaxonomyItem {
  id: number
  name: string
  slug: string
  desc?: string
  color?: string
  postCount: number
}

export interface PostTaxonomy {
  id: number
  name: string
  slug: string
}

export interface PostAuthor {
  id: number
  username: string
  displayName: string
  avatar: string
}

export interface HomePostCard {
  id: number
  title: string
  slug: string
  coverImage: string
  author: PostAuthor
  desc: string
  content?: string
  publishedAt: string
  viewCount: number
  commentCount: number
  wordCount: number
  readingTime: number
  category: PostTaxonomy
  tags: PostTaxonomy[]
  isPinned: boolean
  allowComment: boolean
}

export interface ArticleNavLink {
  id: number
  slug: string
  title: string
  direction: 'prev' | 'next'
}

export interface ArticleComment {
  id: number
  author: string
  avatar: string
  content: string
  createdAt: string
  replyTo?: string
}

export interface ArticleContext {
  previous: ArticleNavLink | null
  next: ArticleNavLink | null
  comments: ArticleComment[]
  isLoggedIn: boolean
}
