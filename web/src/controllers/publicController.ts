import { getMyBlogDetail } from '@/api/meBlogs'
import { mapApiBlogDetailToEditorForm } from '@/mappers/editor'
import {
  createArticleComment,
  getArticleCommentsViewModel,
  getArticleContextViewModel,
  getAuthorPostsViewModel,
  getEditorOptions,
  getHomeFeedPageViewModel,
  getHomePageViewModel,
  getPublicFooterConfig,
  getPublicSiteConfig,
  getSearchPageViewModel,
  getTaxonomyDirectory,
  getTaxonomyPostsViewModel,
} from '@/repositories/publicRepository'

export function loadPublicSiteConfig() {
  return getPublicSiteConfig()
}

export function loadFooterConfig() {
  return getPublicFooterConfig()
}

export function loadHomePage(pageSize = 20) {
  return getHomePageViewModel(pageSize)
}

export function loadHomeFeedPage(
  page: number,
  pageSize: number,
  context?: Parameters<typeof getHomeFeedPageViewModel>[2],
) {
  return getHomeFeedPageViewModel(page, pageSize, context)
}

export function loadArticleContext(articleId: number) {
  return getArticleContextViewModel(articleId)
}

export function loadArticleComments(articleId: number) {
  return getArticleCommentsViewModel(articleId)
}

export function submitArticleComment(articleId: number, content: string, parentId = 0) {
  return createArticleComment(articleId, content, parentId)
}

export function loadSearchResults(keyword: string, page = 1, pageSize = 10) {
  return getSearchPageViewModel(keyword, page, pageSize)
}

export function loadTaxonomyDirectory(kind: 'tags' | 'categories') {
  return getTaxonomyDirectory(kind)
}

export function loadTaxonomyPosts(kind: 'tags' | 'categories', slug: string, page = 1, pageSize = 10) {
  return getTaxonomyPostsViewModel(kind, slug, page, pageSize)
}

export function loadAuthorPosts(username: string, page = 1, pageSize = 10) {
  return getAuthorPostsViewModel(username, page, pageSize)
}

export function loadEditorSelectOptions() {
  return getEditorOptions()
}

export async function loadEditableBlog(id: number) {
  const detail = await getMyBlogDetail(id)
  return mapApiBlogDetailToEditorForm(detail?.blog)
}
