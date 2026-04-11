import type { ArticleContext, HomeConfig, HomePostCard, HomePostsResponse, PagedPostListResponse, SearchResponse, TaxonomyItem } from '@/types/site'
import type { AdminPostRecord } from '@/types/admin'
import { getMockArticleCommentsBySlug, getMockCommentCountBySlug } from '@/mocks/comments'
import { createInitialMockSiteCategories, createInitialMockSiteTags } from '@/mocks/taxonomy'

const homeConfigStorageKey = 'cashew:admin-home-config'
const taxonomyTagsStorageKey = 'cashew:site-taxonomy-tags'
const taxonomyCategoriesStorageKey = 'cashew:site-taxonomy-categories'

let tags: TaxonomyItem[] = readStoredTaxonomyItems(taxonomyTagsStorageKey, createInitialMockSiteTags)

let categories: TaxonomyItem[] = readStoredTaxonomyItems(taxonomyCategoriesStorageKey, createInitialMockSiteCategories)

type MockSitePost = HomePostCard & {
  authorUsername: string
}

let allPosts: MockSitePost[] = [
  {
    id: 1,
    title: '把博客首页做成真正能承载内容的入口',
    slug: 'build-a-real-homepage',
    coverImage: 'https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=1200&q=80',
    desc: '从导航、搜索、内容流到侧边卡片，首页不只是门面，而是读者进入内容体系的总入口。',
    publishedAt: '2026-03-13T12:00:00Z',
    viewCount: 412,
    commentCount: 12,
    wordCount: 2860,
    readingTime: 10,
    category: { id: 1, name: '前端工程', slug: 'frontend' },
    tags: [{ id: 1, name: 'Vue', slug: 'vue' }, { id: 3, name: 'Design', slug: 'design' }],
    isPinned: true,
    authorUsername: 'admin',
  },
  {
    id: 2,
    title: '调试环境下如何优雅地替换真实接口',
    slug: 'debug-mock-api',
    coverImage: 'https://images.unsplash.com/photo-1515879218367-8466d910aaa4?auto=format&fit=crop&w=1200&q=80',
    desc: '把 mock 数据收口到服务层，而不是散落在组件里，后面切回真实接口的成本会低很多。',
    publishedAt: '2026-03-12T09:00:00Z',
    viewCount: 265,
    commentCount: 4,
    wordCount: 1730,
    readingTime: 6,
    category: { id: 1, name: '前端工程', slug: 'frontend' },
    tags: [{ id: 2, name: 'TypeScript', slug: 'typescript' }, { id: 5, name: 'Workflow', slug: 'workflow' }],
    isPinned: true,
    authorUsername: 'admin',
  },
  {
    id: 3,
    title: '内容型网站的 Hero 区为什么不能只放一句欢迎语',
    slug: 'hero-section-for-content-sites',
    coverImage: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=80',
    desc: 'Hero 区要承担品牌定位、内容导流和视觉情绪，不应该只是一个空背景加大标题。',
    publishedAt: '2026-03-11T08:00:00Z',
    viewCount: 138,
    commentCount: 3,
    wordCount: 1210,
    readingTime: 4,
    category: { id: 2, name: '产品设计', slug: 'product-design' },
    tags: [{ id: 3, name: 'Design', slug: 'design' }],
    isPinned: false,
    authorUsername: 'user',
  },
  {
    id: 4,
    title: '用 TypeScript 建模首页聚合配置',
    slug: 'model-home-config-with-typescript',
    coverImage: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1200&q=80',
    desc: '当首页模块变多时，先把配置结构建模清楚，比直接写模板判断更重要。',
    publishedAt: '2026-03-10T08:00:00Z',
    viewCount: 229,
    commentCount: 7,
    wordCount: 1480,
    readingTime: 5,
    category: { id: 1, name: '前端工程', slug: 'frontend' },
    tags: [{ id: 2, name: 'TypeScript', slug: 'typescript' }],
    isPinned: false,
    authorUsername: 'admin',
  },
  {
    id: 5,
    title: '博客文章卡片的信息密度怎么拿捏',
    slug: 'post-card-density',
    coverImage: 'https://images.unsplash.com/photo-1522542550221-31fd19575a2d?auto=format&fit=crop&w=1200&q=80',
    desc: '摘要、分类、标签、统计信息都想放时，卡片很容易变吵，关键是优先级和层级。',
    publishedAt: '2026-03-09T08:00:00Z',
    viewCount: 187,
    commentCount: 2,
    wordCount: 980,
    readingTime: 4,
    category: { id: 2, name: '产品设计', slug: 'product-design' },
    tags: [{ id: 3, name: 'Design', slug: 'design' }, { id: 4, name: 'Performance', slug: 'performance' }],
    isPinned: false,
    authorUsername: 'user',
  },
  {
    id: 6,
    title: '标签和分类该怎么做，读者才真的会点',
    slug: 'taxonomy-interaction',
    coverImage: 'https://images.unsplash.com/photo-1516382799247-87df95d790b7?auto=format&fit=crop&w=1200&q=80',
    desc: '把标签和分类从静态文本做成可筛选的交互入口，首页的探索效率会提升很多。',
    publishedAt: '2026-03-08T08:00:00Z',
    viewCount: 166,
    commentCount: 8,
    wordCount: 1640,
    readingTime: 6,
    category: { id: 3, name: '写作方法', slug: 'writing' },
    tags: [{ id: 5, name: 'Workflow', slug: 'workflow' }],
    isPinned: false,
    authorUsername: 'admin',
  },
  {
    id: 7,
    title: '搜索结果页不应该只是一个列表',
    slug: 'search-page-design',
    coverImage: 'https://images.unsplash.com/photo-1516321497487-e288fb19713f?auto=format&fit=crop&w=1200&q=80',
    desc: '好的搜索结果页至少要说明关键字、结果数量、空状态和继续探索的路径。',
    publishedAt: '2026-03-07T08:00:00Z',
    viewCount: 139,
    commentCount: 1,
    wordCount: 1040,
    readingTime: 4,
    category: { id: 1, name: '前端工程', slug: 'frontend' },
    tags: [{ id: 1, name: 'Vue', slug: 'vue' }, { id: 5, name: 'Workflow', slug: 'workflow' }],
    isPinned: false,
    authorUsername: 'user',
  },
  {
    id: 8,
    title: '如何给个人博客做一个不过时的视觉基线',
    slug: 'timeless-blog-design',
    coverImage: 'https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=1200&q=80',
    desc: '先把背景层次、色板和卡片系统稳住，后续不断加内容时设计才不会失控。',
    publishedAt: '2026-03-06T08:00:00Z',
    viewCount: 214,
    commentCount: 5,
    wordCount: 2120,
    readingTime: 8,
    category: { id: 2, name: '产品设计', slug: 'product-design' },
    tags: [{ id: 3, name: 'Design', slug: 'design' }],
    isPinned: false,
    authorUsername: 'admin',
  },
  {
    id: 9,
    title: '个人写作工作流里最值得自动化的三个环节',
    slug: 'automate-writing-workflow',
    coverImage: 'https://images.unsplash.com/photo-1455390582262-044cdead277a?auto=format&fit=crop&w=1200&q=80',
    desc: '从草稿、发布到分发，找到重复动作最多的环节，自动化改造的收益最明显。',
    publishedAt: '2026-03-05T08:00:00Z',
    viewCount: 121,
    commentCount: 0,
    wordCount: 920,
    readingTime: 3,
    category: { id: 3, name: '写作方法', slug: 'writing' },
    tags: [{ id: 5, name: 'Workflow', slug: 'workflow' }, { id: 6, name: 'Life', slug: 'life' }],
    isPinned: false,
    authorUsername: 'user',
  },
  {
    id: 10,
    title: '前端性能优化里那些最容易被忽略的小地方',
    slug: 'frontend-performance-details',
    coverImage: 'https://images.unsplash.com/photo-1461749280684-dccba630e2f6?auto=format&fit=crop&w=1200&q=80',
    desc: '图片、字体、骨架屏和懒加载这些细节加起来，往往比单点技巧更影响用户感知。',
    publishedAt: '2026-03-04T08:00:00Z',
    viewCount: 309,
    commentCount: 9,
    wordCount: 2400,
    readingTime: 8,
    category: { id: 1, name: '前端工程', slug: 'frontend' },
    tags: [{ id: 4, name: 'Performance', slug: 'performance' }],
    isPinned: false,
    authorUsername: 'admin',
  },
  {
    id: 11,
    title: '在博客里保留一点个人气味',
    slug: 'keep-personal-tone',
    coverImage: 'https://images.unsplash.com/photo-1516979187457-637abb4f9353?auto=format&fit=crop&w=1200&q=80',
    desc: '信息架构可以很理性，但首页依然要能让读者感觉到这是谁在写。',
    publishedAt: '2026-03-03T08:00:00Z',
    viewCount: 98,
    commentCount: 2,
    wordCount: 870,
    readingTime: 3,
    category: { id: 4, name: '生活记录', slug: 'life' },
    tags: [{ id: 6, name: 'Life', slug: 'life' }],
    isPinned: false,
    authorUsername: 'user',
  },
  {
    id: 12,
    title: '为什么内容平台更适合先做聚合接口',
    slug: 'why-aggregate-endpoints',
    coverImage: 'https://images.unsplash.com/photo-1515378791036-0648a3ef77b2?auto=format&fit=crop&w=1200&q=80',
    desc: '首页通常要拉多块异构数据，聚合接口能显著减少前端的请求编排复杂度。',
    publishedAt: '2026-03-02T08:00:00Z',
    viewCount: 276,
    commentCount: 6,
    wordCount: 1570,
    readingTime: 6,
    category: { id: 1, name: '前端工程', slug: 'frontend' },
    tags: [{ id: 2, name: 'TypeScript', slug: 'typescript' }, { id: 5, name: 'Workflow', slug: 'workflow' }],
    isPinned: false,
    authorUsername: 'admin',
  },
]

for (let index = 13; index <= 28; index += 1) {
  allPosts.push({
    id: index,
    title: `首页文章流调试样例 ${index}`,
    slug: `home-feed-sample-${index}`,
    coverImage: 'https://images.unsplash.com/photo-1499750310107-5fef28a66643?auto=format&fit=crop&w=1200&q=80',
    desc: `这是用于本地调试无限滚动和列表布局的示例文章 ${index}。`,
    publishedAt: `2026-02-${String((index % 28) + 1).padStart(2, '0')}T08:00:00Z`,
    viewCount: 50 + index * 3,
    commentCount: index % 5,
    wordCount: 800 + index * 40,
    readingTime: 3 + (index % 6),
    category: {
      id: categories[index % categories.length]!.id,
      name: categories[index % categories.length]!.name,
      slug: categories[index % categories.length]!.slug,
    },
    tags: [{ id: tags[index % tags.length]!.id, name: tags[index % tags.length]!.name, slug: tags[index % tags.length]!.slug }],
    isPinned: false,
    authorUsername: index % 2 === 0 ? 'admin' : 'user',
  })
}

const baseHomeConfig: HomeConfig = {
  navbar: {
    headText: 'Cashew Blog',
    links: [
      { text: '首页', link: '/' },
      { text: '分类', link: '#categories' },
      { text: '标签', link: '#tags' },
    ],
  },
  header: {
    title: '测试的博客',
    subtitle: 'A content-first blog frontend with a readable homepage, discoverable taxonomy, and a clean search flow.',
    animation: true,
    image: 'https://bing.img.run/1920x1080.php',
  },
  announcement: '公告：首页当前运行在可切换数据源模式，接口联调时只需要替换对应数据源实现即可。',
  intro: {
    blogName: 'Cashew Blog',
    hitokoto: '先把基础设施搭稳，再让内容自然生长。',
  },
  sidebar: {
    customHtml: '',
  },
  owner: {
    name: 'cube',
    avatar: '/placeholder-avatar.svg',
    bio: '关注前端工程、内容产品和长期写作，倾向把系统设计得尽量清晰、克制、可扩展。',
    links: [
      { text: 'GitHub', icon: 'github', link: 'https://github.com/' },
      { text: 'Email', icon: 'mail', link: 'mailto:cube@example.com' },
      { text: 'RSS', icon: 'rss', link: '/rss.xml' },
    ],
  },
  footer: {
    text: 'Powered by Cashew Blog. Copyright Cubevlmu 2026.',
    extraHtml: 'Placeholder placeholder',
  },
  summary: {
    postCount: allPosts.length,
    categoryCount: categories.length,
    tagCount: tags.length,
  },
}

function cloneHomeConfig(config: HomeConfig): HomeConfig {
  return {
    ...config,
    navbar: {
      ...config.navbar,
      links: config.navbar.links.map((link) => ({ ...link })),
    },
    header: {
      ...config.header,
    },
    intro: {
      ...config.intro,
    },
    sidebar: {
      ...config.sidebar,
    },
    owner: {
      ...config.owner,
      links: config.owner.links.map((link) => ({ ...link })),
    },
    footer: {
      ...config.footer,
    },
    summary: {
      ...config.summary,
    },
  }
}

function normalizeHomeConfig(config: HomeConfig): HomeConfig {
  const fallback = cloneHomeConfig(baseHomeConfig)
  return {
    ...fallback,
    ...config,
    navbar: {
      ...fallback.navbar,
      ...config.navbar,
      links: config.navbar?.links?.map((link) => ({ ...link })) ?? fallback.navbar.links,
    },
    header: {
      ...fallback.header,
      ...config.header,
    },
    intro: {
      ...fallback.intro,
      ...config.intro,
    },
    sidebar: {
      ...fallback.sidebar,
      ...config.sidebar,
    },
    owner: {
      ...fallback.owner,
      ...config.owner,
      links: config.owner?.links?.map((link) => ({ ...link })) ?? fallback.owner.links,
    },
    footer: {
      ...fallback.footer,
      ...config.footer,
    },
    summary: {
      ...fallback.summary,
      ...config.summary,
    },
  }
}

function readStoredHomeConfig(): HomeConfig | null {
  if (typeof window === 'undefined') {
    return null
  }

  const raw = window.localStorage.getItem(homeConfigStorageKey)
  if (!raw) {
    return null
  }

  try {
    return normalizeHomeConfig(JSON.parse(raw) as HomeConfig)
  } catch {
    window.localStorage.removeItem(homeConfigStorageKey)
    return null
  }
}

function persistHomeConfig(config: HomeConfig) {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.setItem(homeConfigStorageKey, JSON.stringify(config))
}

function readStoredTaxonomyItems(storageKey: string, fallbackFactory: () => TaxonomyItem[]): TaxonomyItem[] {
  if (typeof window === 'undefined') {
    return fallbackFactory()
  }

  const raw = window.localStorage.getItem(storageKey)
  if (!raw) {
    return fallbackFactory()
  }

  try {
    const parsed = JSON.parse(raw) as TaxonomyItem[]
    return Array.isArray(parsed) ? parsed : fallbackFactory()
  } catch {
    window.localStorage.removeItem(storageKey)
    return fallbackFactory()
  }
}

function persistTaxonomyItems(storageKey: string, items: TaxonomyItem[]) {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.setItem(storageKey, JSON.stringify(items))
}

function getCurrentHomeConfig(): HomeConfig {
  const config = readStoredHomeConfig() ?? cloneHomeConfig(baseHomeConfig)
  return {
    ...normalizeHomeConfig(config),
    summary: {
      postCount: allPosts.length,
      categoryCount: categories.length,
      tagCount: tags.length,
    },
  }
}

function createMockMarkdown(post: HomePostCard) {
  return [
    '## 这篇文章会讲什么',
    '',
    `这篇文章围绕 **${post.category.name}** 展开，重点关注 \`${post.tags.map((tag) => tag.name).join(', ')}\` 这些主题在博客前端里的实际落地方式。`,
    '',
    '## 核心要点',
    '',
    '- 把页面结构和数据结构先对齐，再动视觉细节。',
    '- 让列表页、详情页和搜索页共享同一套信息模型。',
    '- 需要调试时，优先把 mock 和真实接口隔离在 service/model 层。',
    '',
    '## 一个简单示例',
    '',
    '```ts',
    `const article = { slug: '${post.slug}', title: '${post.title}' }`,
    "console.log('render markdown article', article)",
    '```',
    '',
    '## 后续可以继续接什么',
    '',
    '1. 正式的 `/api/v1/blogs/slug/:slug` 正文字段。',
    '2. Markdown 目录、代码高亮和图片灯箱。',
    '3. 评论、上一篇/下一篇和相关推荐的真实联动。',
  ].join('\n')
}

for (const post of allPosts) {
  post.content = createMockMarkdown(post)
}

function delay<T>(value: T, timeout = 260): Promise<T> {
  return new Promise((resolve) => {
    window.setTimeout(() => resolve(value), timeout)
  })
}

function toPublicPost(post: MockSitePost): HomePostCard {
  return {
    id: post.id,
    title: post.title,
    slug: post.slug,
    coverImage: post.coverImage,
    desc: post.desc,
    content: post.content,
    publishedAt: post.publishedAt,
    viewCount: post.viewCount,
    commentCount: getMockCommentCountBySlug(post.slug),
    wordCount: post.wordCount,
    readingTime: post.readingTime,
    category: { ...post.category },
    tags: post.tags.map((tag) => ({ ...tag })),
    isPinned: post.isPinned,
  }
}

function getAuthorPosts(username: string) {
  const normalized = username.trim().toLowerCase()
  return allPosts.filter((post) => post.authorUsername.toLowerCase() === normalized)
}

function ensurePostSummary() {
  baseHomeConfig.summary.postCount = allPosts.length
  baseHomeConfig.summary.categoryCount = categories.length
  baseHomeConfig.summary.tagCount = tags.length
}

function countPostsForTag(slug: string) {
  return allPosts.filter((post) => post.tags.some((tag) => tag.slug === slug)).length
}

function countPostsForCategory(slug: string) {
  return allPosts.filter((post) => post.category.slug === slug).length
}

function resolveStoredTag(tag: MockSitePost['tags'][number], index = 0) {
  const matched = tags.find((item) => item.id === tag.id || item.slug === tag.slug || item.name === tag.name)
  if (matched) {
    return {
      id: matched.id,
      name: matched.name,
      slug: matched.slug,
    }
  }

  return ensureTagByName(tag.name, index)
}

function resolveStoredCategory(category: MockSitePost['category']) {
  const matched = categories.find((item) => item.id === category.id || item.slug === category.slug || item.name === category.name)
  if (matched) {
    return {
      id: matched.id,
      name: matched.name,
      slug: matched.slug,
    }
  }

  return category
}

function normalizeAllPostsTaxonomy() {
  allPosts = allPosts.map((post) => ({
    ...post,
    category: resolveStoredCategory(post.category),
    tags: post.tags
      .map((tag, index) => resolveStoredTag(tag, index))
      .filter((tag, index, list) => list.findIndex((item) => item.id === tag.id) === index),
  }))
}

function syncTaxonomyCounts() {
  normalizeAllPostsTaxonomy()
  tags = tags.map((tag) => ({
    ...tag,
    postCount: countPostsForTag(tag.slug),
  }))
  categories = categories.map((category) => ({
    ...category,
    postCount: countPostsForCategory(category.slug),
  }))
  persistTaxonomyItems(taxonomyTagsStorageKey, tags)
  persistTaxonomyItems(taxonomyCategoriesStorageKey, categories)
  ensurePostSummary()
}

normalizeAllPostsTaxonomy()
syncTaxonomyCounts()

function findCategoryByName(name: string) {
  return categories.find((item) => item.name === name) ?? null
}

function ensureTagByName(name: string, index: number) {
  const existing = tags.find((item) => item.name === name)
  if (existing) {
    return existing
  }

  return {
    id: 1000 + index,
    name,
    slug: name.toLowerCase().replace(/\s+/g, '-'),
    postCount: 0,
  }
}

function buildMockMarkdown(_post: AdminPostRecord, content?: string) {
  if (content?.trim()) {
    return content
  }

  return [
    '## 后台同步说明',
    '',
    '这篇内容来自后台文章数据集，首页和后台现在共享同一篇文章的核心字段。',
  ].join('\n')
}

export function upsertMockSitePostFromAdmin(post: AdminPostRecord, content?: string) {
  if (post.state !== 'public') {
    allPosts = allPosts.filter((item) => item.id !== post.id)
    syncTaxonomyCounts()
    return
  }

  const category = findCategoryByName(post.category) ?? {
    id: 10_000 + post.id,
    name: post.category,
    slug: post.category.toLowerCase().replace(/\s+/g, '-'),
  }
  const nextPost: MockSitePost = {
    id: post.id,
    title: post.title,
    slug: post.slug,
    coverImage: post.coverImage,
    desc: post.desc,
    content: buildMockMarkdown(post, content),
    publishedAt: post.publishedAt,
    viewCount: post.viewCount,
    commentCount: post.commentCount,
    wordCount: post.wordCount,
    readingTime: post.readingTime,
    category,
    tags: post.tags.map((tag, index) => ensureTagByName(tag, index)),
    isPinned: post.isPinned,
    authorUsername: post.author.username,
  }

  const existingIndex = allPosts.findIndex((item) => item.id === post.id)
  if (existingIndex >= 0) {
    allPosts = allPosts.map((item) => (item.id === post.id ? nextPost : item))
  } else {
    allPosts = [nextPost, ...allPosts]
  }

  syncTaxonomyCounts()
}

export function removeMockSitePostsByIds(ids: number[]) {
  console.info('[mock-site-posts] remove', { ids, beforeCount: allPosts.length })
  allPosts = allPosts.filter((post) => !ids.includes(post.id))
  syncTaxonomyCounts()
  console.info('[mock-site-posts] remove:done', { ids, afterCount: allPosts.length })
}

export function syncMockPinnedPosts(ids: number[], isPinned: boolean) {
  console.info('[mock-site-posts] pin-sync', { ids, isPinned })
  allPosts = allPosts.map((post) => (ids.includes(post.id) ? { ...post, isPinned } : post))
  console.info('[mock-site-posts] pin-sync:done', {
    ids,
    isPinned,
    pinnedPosts: allPosts.filter((post) => post.isPinned).map((post) => post.id),
  })
}

export function getSiteTaxonomyTags() {
  syncTaxonomyCounts()
  return tags.map((tag) => ({ ...tag }))
}

export function getSiteTaxonomyCategories() {
  syncTaxonomyCounts()
  return categories.map((category) => ({ ...category }))
}

export function createMockSiteTag(payload: Pick<TaxonomyItem, 'name' | 'slug'> & Partial<Pick<TaxonomyItem, 'desc' | 'color'>>) {
  const nextTag: TaxonomyItem = {
    id: Math.max(0, ...tags.map((tag) => tag.id)) + 1,
    name: payload.name,
    slug: payload.slug,
    desc: payload.desc,
    color: payload.color,
    postCount: 0,
  }
  tags = [...tags, nextTag]
  syncTaxonomyCounts()
  return { ...nextTag }
}

export function updateMockSiteTag(id: number, payload: Pick<TaxonomyItem, 'name' | 'slug'> & Partial<Pick<TaxonomyItem, 'desc' | 'color'>>) {
  const currentTag = tags.find((tag) => tag.id === id) ?? null
  if (!currentTag) {
    return null
  }

  const updatedTag: TaxonomyItem = {
    ...currentTag,
    name: payload.name,
    slug: payload.slug,
    desc: payload.desc,
    color: payload.color ?? currentTag.color,
  }
  tags = tags.map((tag) => (tag.id === id ? updatedTag : tag))
  allPosts = allPosts.map((post) => ({
    ...post,
    tags: post.tags.map((tag) => (tag.id === id && updatedTag ? { id: updatedTag.id, name: updatedTag.name, slug: updatedTag.slug } : tag)),
  }))
  syncTaxonomyCounts()
  return { ...updatedTag }
}

export function deleteMockSiteTags(ids: number[]) {
  tags = tags.filter((tag) => !ids.includes(tag.id))
  allPosts = allPosts.map((post) => ({
    ...post,
    tags: post.tags.filter((tag) => !ids.includes(tag.id)),
  }))
  syncTaxonomyCounts()
}

export function createMockSiteCategory(payload: Pick<TaxonomyItem, 'name' | 'slug'> & Partial<Pick<TaxonomyItem, 'desc'>>) {
  const nextCategory: TaxonomyItem = {
    id: Math.max(0, ...categories.map((category) => category.id)) + 1,
    name: payload.name,
    slug: payload.slug,
    desc: payload.desc,
    postCount: 0,
  }
  categories = [...categories, nextCategory]
  syncTaxonomyCounts()
  return { ...nextCategory }
}

export function updateMockSiteCategory(id: number, payload: Pick<TaxonomyItem, 'name' | 'slug'> & Partial<Pick<TaxonomyItem, 'desc'>>) {
  const currentCategory = categories.find((category) => category.id === id) ?? null
  if (!currentCategory) {
    return null
  }

  const updatedCategory: TaxonomyItem = {
    ...currentCategory,
    name: payload.name,
    slug: payload.slug,
    desc: payload.desc,
  }
  categories = categories.map((category) => (category.id === id ? updatedCategory : category))
  allPosts = allPosts.map((post) => (
    post.category.id === id && updatedCategory
      ? { ...post, category: { id: updatedCategory.id, name: updatedCategory.name, slug: updatedCategory.slug } }
      : post
  ))
  syncTaxonomyCounts()
  return { ...updatedCategory }
}

export function deleteMockSiteCategories(ids: number[], fallbackCategory?: { id: number; name: string; slug: string }) {
  categories = categories.filter((category) => !ids.includes(category.id))
  if (fallbackCategory) {
    allPosts = allPosts.map((post) => (
      ids.includes(post.category.id)
        ? { ...post, category: { ...fallbackCategory } }
        : post
    ))
  }
  syncTaxonomyCounts()
}

export async function getMockHomeConfig(): Promise<HomeConfig> {
  return delay(getCurrentHomeConfig())
}

export async function updateMockHomeConfig(config: HomeConfig): Promise<HomeConfig> {
  const nextConfig = normalizeHomeConfig(config)
  persistHomeConfig(nextConfig)
  return delay(nextConfig, 220)
}

export async function getMockTags(keyword = ''): Promise<TaxonomyItem[]> {
  const normalized = keyword.trim().toLowerCase()
  const currentTags = getSiteTaxonomyTags()
  return delay(currentTags.filter((item) => !normalized || item.name.toLowerCase().includes(normalized)), 180)
}

export async function getMockCategories(keyword = ''): Promise<TaxonomyItem[]> {
  const normalized = keyword.trim().toLowerCase()
  const currentCategories = getSiteTaxonomyCategories()
  return delay(currentCategories.filter((item) => !normalized || item.name.toLowerCase().includes(normalized)), 180)
}

export async function getMockHomePosts(page = 1, pageSize = 20): Promise<HomePostsResponse> {
  const pinned = page === 1 ? allPosts.filter((item) => item.isPinned).map(toPublicPost) : []
  const normalPosts = allPosts.filter((item) => !item.isPinned).map(toPublicPost)
  const start = (page - 1) * pageSize
  const list = normalPosts.slice(start, start + pageSize)
  return delay({
    pinned,
    list,
    page,
    pageSize,
    hasMore: start + pageSize < normalPosts.length,
  })
}

export async function getMockSearchPosts(keyword: string, page = 1, pageSize = 10): Promise<SearchResponse> {
  const normalized = keyword.trim().toLowerCase()
  const matched = allPosts.filter((item) => {
    const terms = [item.title, item.desc, item.category.name, item.tags.map((tag) => tag.name).join(' ')].join(' ').toLowerCase()
    return terms.includes(normalized)
  }).map(toPublicPost)
  const start = (page - 1) * pageSize
  return delay({
    keyword,
    list: matched.slice(start, start + pageSize),
    page,
    pageSize,
    total: matched.length,
  })
}

export async function getMockPostsByTag(slug: string, page = 1, pageSize = 10): Promise<PagedPostListResponse> {
  const matched = allPosts.filter((item) => item.tags.some((tag) => tag.slug === slug)).map(toPublicPost)
  const start = (page - 1) * pageSize

  return delay({
    list: matched.slice(start, start + pageSize),
    page,
    pageSize,
    total: matched.length,
  })
}

export async function getMockPostsByCategory(slug: string, page = 1, pageSize = 10): Promise<PagedPostListResponse> {
  const matched = allPosts.filter((item) => item.category.slug === slug).map(toPublicPost)
  const start = (page - 1) * pageSize

  return delay({
    list: matched.slice(start, start + pageSize),
    page,
    pageSize,
    total: matched.length,
  })
}

export async function getMockPostsByAuthor(username: string, page = 1, pageSize = 10): Promise<PagedPostListResponse> {
  const matched = getAuthorPosts(username).map(toPublicPost)
  const start = (page - 1) * pageSize

  return delay({
    list: matched.slice(start, start + pageSize),
    page,
    pageSize,
    total: matched.length,
  })
}

export async function getMockPostBySlug(slug: string): Promise<HomePostCard | null> {
  const post = allPosts.find((item) => item.slug === slug)
  return delay(post ? toPublicPost(post) : null, 150)
}

export async function getMockPostById(id: number): Promise<HomePostCard | null> {
  const post = allPosts.find((item) => item.id === id)
  return delay(post ? toPublicPost(post) : null, 150)
}

export async function getMockArticleContext(slug: string): Promise<ArticleContext> {
  const currentIndex = allPosts.findIndex((item) => item.slug === slug)
  const previousPost = currentIndex > 0 ? allPosts[currentIndex - 1] : null
  const nextPost = currentIndex >= 0 && currentIndex < allPosts.length - 1 ? allPosts[currentIndex + 1] : null

  return delay(
    {
      previous: previousPost
        ? { id: previousPost.id, slug: previousPost.slug, title: previousPost.title, direction: 'prev' }
        : null,
      next: nextPost
        ? { id: nextPost.id, slug: nextPost.slug, title: nextPost.title, direction: 'next' }
        : null,
      comments: currentIndex >= 0 ? getMockArticleCommentsBySlug(slug) : [],
      isLoggedIn: false,
    },
    180,
  )
}

type MockDataIssue = {
  type: 'duplicate-tag' | 'duplicate-category' | 'orphan-post-tag' | 'orphan-post-category' | 'duplicate-post-slug'
  message: string
}

function collectDuplicateIssues(items: TaxonomyItem[], kind: 'tag' | 'category'): MockDataIssue[] {
  const issues: MockDataIssue[] = []
  const slugSeen = new Map<string, number>()
  const idSeen = new Map<number, number>()

  for (const item of items) {
    const slugCount = (slugSeen.get(item.slug) ?? 0) + 1
    slugSeen.set(item.slug, slugCount)
    if (slugCount > 1) {
      issues.push({
        type: kind === 'tag' ? 'duplicate-tag' : 'duplicate-category',
        message: `${kind} slug 重复: ${item.slug}`,
      })
    }

    const idCount = (idSeen.get(item.id) ?? 0) + 1
    idSeen.set(item.id, idCount)
    if (idCount > 1) {
      issues.push({
        type: kind === 'tag' ? 'duplicate-tag' : 'duplicate-category',
        message: `${kind} id 重复: ${item.id}`,
      })
    }
  }

  return issues
}

export function validateMockSiteData() {
  syncTaxonomyCounts()

  const issues: MockDataIssue[] = [
    ...collectDuplicateIssues(tags, 'tag'),
    ...collectDuplicateIssues(categories, 'category'),
  ]

  const postSlugSeen = new Map<string, number>()
  const tagSlugSet = new Set(tags.map((item) => item.slug))
  const categorySlugSet = new Set(categories.map((item) => item.slug))

  for (const post of allPosts) {
    const postSlugCount = (postSlugSeen.get(post.slug) ?? 0) + 1
    postSlugSeen.set(post.slug, postSlugCount)
    if (postSlugCount > 1) {
      issues.push({
        type: 'duplicate-post-slug',
        message: `post slug 重复: ${post.slug}`,
      })
    }

    if (!categorySlugSet.has(post.category.slug)) {
      issues.push({
        type: 'orphan-post-category',
        message: `post[${post.slug}] 分类未命中 taxonomy: ${post.category.slug}`,
      })
    }

    for (const tag of post.tags) {
      if (!tagSlugSet.has(tag.slug)) {
        issues.push({
          type: 'orphan-post-tag',
          message: `post[${post.slug}] 标签未命中 taxonomy: ${tag.slug}`,
        })
      }
    }
  }

  return {
    ok: issues.length === 0,
    issues,
  }
}
