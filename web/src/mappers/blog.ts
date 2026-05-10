import { fallbackCoverImage, mapBlogContextToArticleContext, mapBlogPageToFeed, mapBlogToHomePostCard } from '@/mappers/contentApi'
import type {
  ApiAuthorBlogsData,
  ApiBlogContextData,
  ApiBlogDetail,
  ApiBlogListItem,
  ApiPageData,
  ApiSearchData,
  ApiSearchResultItem,
} from '@/types/api'
import type { HomePageVM, PostCardVM, PostContextVM, SearchPageVM } from '@/types/vm'

function estimateWordCount(text: string) {
  return Math.max(1, text.trim().length)
}

function estimateReadingTime(wordCount: number) {
  return Math.max(1, Math.ceil(wordCount / 300))
}

export function mapApiBlogToPostCardVM(blog: ApiBlogListItem | ApiBlogDetail): PostCardVM {
  return mapBlogToHomePostCard(blog)
}

export function mapApiSearchResultToPostCardVM(item: ApiSearchResultItem): PostCardVM {
  const wordCount = estimateWordCount(item.summary || item.title)

  return {
    id: item.id,
    title: item.title,
    slug: item.slug,
    coverImage: fallbackCoverImage,
    author: {
      id: 0,
      username: '',
      displayName: '匿名作者',
      avatar: '/placeholder-avatar.svg',
    },
    desc: item.summary,
    content: undefined,
    publishedAt: item.published_at,
    viewCount: 0,
    commentCount: 0,
    wordCount,
    readingTime: estimateReadingTime(wordCount),
    category: item.category
      ? {
          id: item.category.id,
          name: item.category.name,
          slug: item.category.slug,
        }
      : {
          id: 0,
          name: '未分类',
          slug: '',
        },
    tags: item.tags.map((tag) => ({
      id: tag.id,
      name: tag.name,
      slug: tag.slug,
    })),
    isPinned: false,
    allowComment: true,
  }
}

export function mapApiHomePageToVM(
  config: HomePageVM['config'],
  tags: HomePageVM['tags'],
  categories: HomePageVM['categories'],
  pageData: ApiPageData<ApiBlogListItem>,
): HomePageVM {
  const feed = mapBlogPageToFeed(pageData)

  return {
    config,
    tags,
    categories,
    pinnedPosts: feed.pinned,
    posts: feed.list,
    page: feed.page,
    hasMore: feed.hasMore,
  }
}

export function mapApiBlogContextToPostContextVM(data: ApiBlogContextData): PostContextVM {
  return {
    post: mapApiBlogToPostCardVM(data.blog),
    context: mapBlogContextToArticleContext(data),
  }
}

export function mapApiSearchDataToVM(data: ApiSearchData): SearchPageVM {
  return {
    keyword: data.keyword,
    list: data.list.map(mapApiSearchResultToPostCardVM),
    page: data.page,
    pageSize: data.page_size,
    total: data.total,
  }
}

export function mapApiAuthorBlogsToPagedList(data: ApiAuthorBlogsData) {
  return {
    list: data.list.map(mapApiBlogToPostCardVM),
    page: data.page,
    pageSize: data.page_size,
    total: data.total,
  }
}
