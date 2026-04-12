import { getBlogContextById, getHomePosts } from '@/api/blogs'
import { createBlogCommentById, getBlogCommentsById } from '@/api/comments'
import { searchBlogs } from '@/api/search'
import { getPublicSettings } from '@/api/settings'
import { getCategories, getTags, getTaxonomyBlogs } from '@/api/taxonomy'
import { getAuthorBlogs } from '@/api/users'
import { mapApiAuthorBlogsToPagedList, mapApiBlogContextToPostContextVM, mapApiHomePageToVM, mapApiSearchDataToVM } from '@/mappers/blog'
import { mapApiCommentListToArticleComments } from '@/mappers/comment'
import { mapBlogPageToPagedList } from '@/mappers/contentApi'
import { mapApiCategoryToAdminCategoryOption, mapApiBlogDetailToEditorForm, mapApiTagToAdminTagOption } from '@/mappers/editor'
import { mapApiPublicSettingsToSiteConfigVM } from '@/mappers/settings'
import { mapApiCategoryToTaxonomyVM, mapApiTagToTaxonomyVM } from '@/mappers/taxonomy'

export async function getPublicSiteConfig() {
  return mapApiPublicSettingsToSiteConfigVM(await getPublicSettings())
}

export async function getPublicFooterConfig() {
  return (await getPublicSiteConfig()).footer
}

export async function getHomePageViewModel(pageSize = 20) {
  const [config, tagPage, categoryPage, homePostsPage] = await Promise.all([
    getPublicSiteConfig(),
    getTags(),
    getCategories(),
    getHomePosts(1, pageSize),
  ])
  config.summary.postCount = homePostsPage.total
  config.summary.tagCount = tagPage.total
  config.summary.categoryCount = categoryPage.total

  return mapApiHomePageToVM(
    config,
    tagPage.list.map(mapApiTagToTaxonomyVM),
    categoryPage.list.map(mapApiCategoryToTaxonomyVM),
    homePostsPage,
  )
}

export async function getHomeFeedPageViewModel(
  page: number,
  pageSize: number,
  context?: {
    config?: Awaited<ReturnType<typeof getPublicSiteConfig>>
    tags?: Array<ReturnType<typeof mapApiTagToTaxonomyVM>>
    categories?: Array<ReturnType<typeof mapApiCategoryToTaxonomyVM>>
  },
) {
  const config = context?.config ?? await getPublicSiteConfig()
  const tags = context?.tags ?? (await getTags()).list.map(mapApiTagToTaxonomyVM)
  const categories = context?.categories ?? (await getCategories()).list.map(mapApiCategoryToTaxonomyVM)
  const homePostsPage = await getHomePosts(page, pageSize)
  config.summary.postCount = homePostsPage.total

  return mapApiHomePageToVM(config, tags, categories, homePostsPage)
}

export async function getArticleContextViewModel(articleId: number) {
  return mapApiBlogContextToPostContextVM(await getBlogContextById(articleId))
}

export async function getArticleCommentsViewModel(articleId: number) {
  const data = await getBlogCommentsById(articleId)
  return mapApiCommentListToArticleComments(data.list)
}

export async function createArticleComment(articleId: number, content: string, parentId = 0) {
  await createBlogCommentById(articleId, content, parentId)
}

export async function getSearchPageViewModel(keyword: string, page = 1, pageSize = 10) {
  return mapApiSearchDataToVM(await searchBlogs(keyword, page, pageSize))
}

export async function getTaxonomyDirectory(kind: 'tags' | 'categories') {
  const page = kind === 'tags' ? await getTags() : await getCategories()

  return kind === 'tags'
    ? page.list.map(mapApiTagToTaxonomyVM)
    : page.list.map(mapApiCategoryToTaxonomyVM)
}

export async function getTaxonomyPostsViewModel(kind: 'tags' | 'categories', slug: string, page = 1, pageSize = 10) {
  return mapBlogPageToPagedList(await getTaxonomyBlogs(kind, slug, page, pageSize))
}

export async function getAuthorPostsViewModel(username: string, page = 1, pageSize = 10) {
  return mapApiAuthorBlogsToPagedList(await getAuthorBlogs(username, page, pageSize))
}

export async function getEditorOptions() {
  const [categoryPage, tagPage] = await Promise.all([
    getCategories(1, 100),
    getTags(1, 100),
  ])

  return {
    categories: categoryPage.list.map(mapApiCategoryToAdminCategoryOption),
    tags: tagPage.list.map(mapApiTagToAdminTagOption),
  }
}

export async function getEditableBlogForm(id: number) {
  const { getEditableBlogDetail } = await import('@/api/meBlogs')
  const detail = await getEditableBlogDetail(id)
  return mapApiBlogDetailToEditorForm(detail?.blog)
}
