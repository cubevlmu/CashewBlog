import { mapCategoryToTaxonomyItem, mapTagToTaxonomyItem } from '@/mappers/taxonomyApi'
import { assetUrl } from '@/mappers/assetUrl'
import type { ArticleComment, ArticleContext, HomePostCard } from '@/types/content'
import type { HomePostsResponse, PagedPostListResponse, SearchResponse } from '@/types/responses'
import type {
  ApiBlogContextData,
  ApiBlogDetail,
  ApiBlogListItem,
  ApiCommentItem,
  ApiPageData,
  ApiUserSummary,
} from '@/types/api'

function fallbackAvatar() {
  return '/placeholder-avatar.svg'
}

export const fallbackCoverImage = '/default-cover.svg'

function pickAvatar(user?: ApiUserSummary | null) {
  return assetUrl(user?.avatar) || fallbackAvatar()
}

function pickCover(asset: ApiBlogListItem['title_image']) {
  return assetUrl(asset) || fallbackCoverImage
}

function estimateWordCount(blog: Pick<ApiBlogListItem, 'summary'> & Partial<Pick<ApiBlogDetail, 'content_markdown'>>) {
  const text = blog.content_markdown || blog.summary || ''
  return text.trim().length
}

function estimateReadingTime(wordCount: number) {
  return Math.max(1, Math.ceil(wordCount / 300))
}

export function mapBlogToHomePostCard(blog: ApiBlogListItem | ApiBlogDetail): HomePostCard {
  const wordCount = estimateWordCount(blog)
  const authorName = blog.author?.nickname || blog.author?.username || '匿名作者'

  return {
    id: blog.id,
    title: blog.title,
    slug: blog.slug,
    coverImage: pickCover(blog.title_image),
    author: {
      id: blog.author?.id ?? 0,
      username: blog.author?.username ?? '',
      displayName: authorName,
      avatar: pickAvatar(blog.author),
    },
    desc: blog.summary,
    content: 'content_markdown' in blog ? blog.content_markdown : undefined,
    publishedAt: blog.published_at || blog.updated_at || blog.created_at,
    viewCount: blog.view_count,
    commentCount: blog.comment_count,
    wordCount,
    readingTime: estimateReadingTime(wordCount),
    category: mapCategoryToTaxonomyItem({
      id: blog.category?.id ?? 0,
      name: blog.category?.name ?? '未分类',
      slug: blog.category?.slug ?? '',
      created_at: '',
    }),
    tags: blog.tags.map(mapTagToTaxonomyItem),
    isPinned: blog.is_top,
    allowComment: blog.allow_comment,
  }
}

export function mapBlogPageToFeed(pageData: ApiPageData<ApiBlogListItem>): HomePostsResponse {
  const cards = pageData.list.map(mapBlogToHomePostCard)
  const pinned = pageData.page === 1 ? cards.filter((item) => item.isPinned) : []
  const list = cards.filter((item) => !item.isPinned || pageData.page > 1)

  return {
    pinned,
    list,
    page: pageData.page,
    pageSize: pageData.page_size,
    hasMore: pageData.page * pageData.page_size < pageData.total,
  }
}

export function mapBlogPageToPagedList(pageData: ApiPageData<ApiBlogListItem>): PagedPostListResponse {
  return {
    list: pageData.list.map(mapBlogToHomePostCard),
    page: pageData.page,
    pageSize: pageData.page_size,
    total: pageData.total,
  }
}

export function mapSearchResponse(keyword: string, pageData: ApiPageData<ApiBlogListItem>): SearchResponse {
  return {
    keyword,
    list: pageData.list.map(mapBlogToHomePostCard),
    page: pageData.page,
    pageSize: pageData.page_size,
    total: pageData.total,
  }
}

function flattenComments(items: ApiCommentItem[], replyTo?: string): ArticleComment[] {
  return items.flatMap((item) => {
    const author = item.user?.nickname || item.user?.username || '匿名用户'
    const current: ArticleComment = {
      id: item.id,
      author,
      avatar: pickAvatar(item.user),
      content: item.content,
      createdAt: item.created_at,
      replyTo,
    }

    return [current, ...flattenComments(item.children || [], author)]
  })
}

export function mapApiCommentsToArticleComments(items: ApiCommentItem[]): ArticleComment[] {
  return flattenComments(items)
}

export function mapBlogContextToArticleContext(data: ApiBlogContextData): ArticleContext {
  return {
    previous: data.prev_blog
      ? {
          id: data.prev_blog.id,
          slug: data.prev_blog.slug,
          title: data.prev_blog.title,
          direction: 'prev',
        }
      : null,
    next: data.next_blog
      ? {
          id: data.next_blog.id,
          slug: data.next_blog.slug,
          title: data.next_blog.title,
          direction: 'next',
        }
      : null,
    comments: mapApiCommentsToArticleComments(data.comments),
    isLoggedIn: false,
  }
}
