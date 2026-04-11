import type { AdminCommentRecord } from '@/types/admin'
import type { ArticleComment } from '@/types/site'

type MockCommentRecord = {
  id: number
  blogSlug: string
  postTitle: string
  author: string
  authorEmail: string
  avatar: string
  content: string
  submittedAt: string
  state: AdminCommentRecord['state']
  replyTo?: string
}

type CreateMockCommentPayload = {
  blogSlug: string
  postTitle: string
  author: string
  authorEmail: string
  avatar: string
  content: string
  replyTo?: string
}

const commentsStorageKey = 'cashew:mock-comments'

const initialComments: MockCommentRecord[] = [
  {
    id: 1,
    blogSlug: 'build-a-real-homepage',
    postTitle: '把博客首页做成真正能承载内容的入口',
    author: 'Mia',
    authorEmail: 'mia@example.com',
    avatar: '/placeholder-avatar.svg',
    content: '这篇文章的结构很清楚，尤其是首页和详情切换这一段很有参考价值。',
    submittedAt: '2026-03-12T14:20:00Z',
    state: 'approved',
  },
  {
    id: 2,
    blogSlug: 'build-a-real-homepage',
    postTitle: '把博客首页做成真正能承载内容的入口',
    author: 'Leo',
    authorEmail: 'leo@example.com',
    avatar: '/placeholder-avatar.svg',
    content: '如果后面把评论和文章详情一起聚合返回，前端会更轻一些。',
    submittedAt: '2026-03-12T16:05:00Z',
    state: 'pending',
    replyTo: 'Mia',
  },
  {
    id: 3,
    blogSlug: 'taxonomy-interaction',
    postTitle: '标签和分类该怎么做，读者才真的会点',
    author: 'Nora',
    authorEmail: 'nora@example.com',
    avatar: '/placeholder-avatar.svg',
    content: '标签管理和分类管理的后台交互终于统一了。',
    submittedAt: '2026-03-11T09:30:00Z',
    state: 'approved',
  },
]

let mockComments: MockCommentRecord[] = readStoredComments()

function cloneComment(comment: MockCommentRecord): MockCommentRecord {
  return { ...comment }
}

function persistComments() {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.setItem(commentsStorageKey, JSON.stringify(mockComments))
}

function readStoredComments(): MockCommentRecord[] {
  if (typeof window === 'undefined') {
    return initialComments.map(cloneComment)
  }

  const raw = window.localStorage.getItem(commentsStorageKey)
  if (!raw) {
    return initialComments.map(cloneComment)
  }

  try {
    const parsed = JSON.parse(raw) as MockCommentRecord[]
    return Array.isArray(parsed) ? parsed.map(cloneComment) : initialComments.map(cloneComment)
  } catch {
    window.localStorage.removeItem(commentsStorageKey)
    return initialComments.map(cloneComment)
  }
}

function toArticleComment(comment: MockCommentRecord): ArticleComment {
  return {
    id: comment.id,
    author: comment.author,
    avatar: comment.avatar,
    content: comment.content,
    createdAt: comment.submittedAt,
    replyTo: comment.replyTo,
  }
}

function toAdminComment(comment: MockCommentRecord): AdminCommentRecord {
  return {
    id: comment.id,
    author: comment.author,
    authorEmail: comment.authorEmail,
    avatar: comment.avatar,
    content: comment.content,
    replyTo: comment.replyTo,
    submittedAt: comment.submittedAt,
    state: comment.state,
    postTitle: comment.postTitle,
  }
}

function nextCommentId() {
  return Math.max(0, ...mockComments.map((comment) => comment.id)) + 1
}

export function getMockArticleCommentsBySlug(slug: string): ArticleComment[] {
  return mockComments
    .filter((comment) => comment.blogSlug === slug && comment.state === 'approved')
    .sort((left, right) => new Date(left.submittedAt).getTime() - new Date(right.submittedAt).getTime())
    .map(toArticleComment)
}

export function getMockAdminCommentsData(): AdminCommentRecord[] {
  return mockComments
    .map(toAdminComment)
    .sort((left, right) => new Date(right.submittedAt).getTime() - new Date(left.submittedAt).getTime())
}

export function createMockComment(payload: CreateMockCommentPayload): AdminCommentRecord {
  const nextComment: MockCommentRecord = {
    id: nextCommentId(),
    blogSlug: payload.blogSlug,
    postTitle: payload.postTitle,
    author: payload.author,
    authorEmail: payload.authorEmail,
    avatar: payload.avatar,
    content: payload.content,
    submittedAt: new Date().toISOString(),
    state: 'approved',
    replyTo: payload.replyTo,
  }

  mockComments = [...mockComments, nextComment]
  persistComments()
  return toAdminComment(nextComment)
}

export function updateMockCommentsState(ids: number[], state: AdminCommentRecord['state']) {
  mockComments = mockComments.map((comment) => (ids.includes(comment.id) ? { ...comment, state } : comment))
  persistComments()
}

export function deleteMockComments(ids: number[]) {
  mockComments = mockComments.filter((comment) => !ids.includes(comment.id))
  persistComments()
}

export function getMockCommentCountBySlug(slug: string): number {
  return mockComments.filter((comment) => comment.blogSlug === slug && comment.state === 'approved').length
}

export function getMockCommentCountByTitle(postTitle: string): number {
  return mockComments.filter((comment) => comment.postTitle === postTitle && comment.state === 'approved').length
}
