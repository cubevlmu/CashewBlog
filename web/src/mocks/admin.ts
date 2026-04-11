import { authState } from '@/stores/authStore'
import type {
  AdminAssetRecord,
  AdminCategoryRecord,
  AdminCommentRecord,
  AdminPostEditorRecord,
  AdminPostListParams,
  AdminPostListResponse,
  AdminPostRecord,
  AdminPostState,
  AdminTagRecord,
  AdminUserRecord,
} from '@/types/admin'
import {
  createMockSiteCategory,
  createMockSiteTag,
  deleteMockSiteCategories,
  deleteMockSiteTags,
  getMockPostById,
  getSiteTaxonomyCategories,
  getSiteTaxonomyTags,
  removeMockSitePostsByIds,
  syncMockPinnedPosts,
  updateMockSiteCategory,
  updateMockSiteTag,
  upsertMockSitePostFromAdmin,
} from '@/mocks/site'
import {
  deleteMockComments,
  getMockAdminCommentsData,
  getMockCommentCountBySlug,
  getMockCommentCountByTitle,
  updateMockCommentsState,
} from '@/mocks/comments'
import { createInitialMockAdminCategories, createInitialMockAdminTags } from '@/mocks/taxonomy'
import type { AdminDashboardSummary } from '@/types/adminDashboard'

const adminAuthor = {
  id: 1,
  username: 'admin',
  displayName: 'Admin Cube',
  avatar: '/placeholder-avatar.svg',
}

const userAuthor = {
  id: 2,
  username: 'user',
  displayName: 'Normal Cube',
  avatar: '/placeholder-avatar.svg',
}

const postSeeds: Array<[string, string, string, string[]]> = [
  ['把博客首页做成真正能承载内容的入口', '首页作为内容系统入口的布局与交互设计。', '前端工程', ['Vue', 'Design']],
  ['调试环境下如何优雅地替换真实接口', '通过 mock service 和 model 解耦调试数据与真实请求。', '前端工程', ['TypeScript', 'Workflow']],
  ['内容型网站的 Hero 区为什么不能只放一句欢迎语', 'Hero 区需要承担视觉、定位与导流三重职责。', '产品设计', ['Design']],
  ['用 TypeScript 建模首页聚合配置', '在前端先建立稳定的数据结构，再做复杂模板。', '前端工程', ['TypeScript']],
  ['博客文章卡片的信息密度怎么拿捏', '卡片的信息层级决定首页是否能读。', '产品设计', ['Design', 'Performance']],
  ['标签和分类该怎么做，读者才真的会点', '标签和分类不只是显示，还应该成为发现入口。', '写作方法', ['Workflow']],
  ['搜索结果页不应该只是一个列表', '搜索页需要关键词语义、总数和继续探索路径。', '前端工程', ['Vue', 'Workflow']],
  ['如何给个人博客做一个不过时的视觉基线', '通过统一色板、卡片和留白建立稳定视觉系统。', '产品设计', ['Design']],
  ['个人写作工作流里最值得自动化的三个环节', '写作链路里重复度最高的部分优先自动化。', '写作方法', ['Workflow', 'Life']],
  ['前端性能优化里那些最容易被忽略的小地方', '用户感知速度往往来自很多小优化的叠加。', '前端工程', ['Performance']],
  ['在博客里保留一点个人气味', '理性的信息架构之上仍然需要作者气味。', '生活记录', ['Life']],
  ['为什么内容平台更适合先做聚合接口', '聚合接口能降低首页复杂数据的编排成本。', '前端工程', ['TypeScript', 'Workflow']],
]

function createMockPosts(): AdminPostRecord[] {
  return Array.from({ length: 28 }, (_, index) => {
    const seed = postSeeds[index % postSeeds.length]!
    const author = index % 3 === 0 ? userAuthor : adminAuthor
    const baseDate = new Date(2026, 2, Math.max(1, 28 - index), 10, 30)
    const state: AdminPostState = index % 7 === 0 ? 'private' : index % 11 === 0 ? 'archived' : 'public'

    return {
      id: index + 1,
      title: `${seed[0]} ${index + 1}`,
      slug: `admin-post-${index + 1}`,
      desc: seed[1],
      author,
      category: seed[2],
      tags: seed[3],
      state,
      auditStatus: state === 'private' ? 'pending' : 'approved',
      publishedAt: baseDate.toISOString(),
      updatedAt: new Date(baseDate.getTime() + 1000 * 60 * 60 * 6).toISOString(),
      viewCount: 120 + index * 17,
      likeCount: 18 + index * 3,
      commentCount: index % 9,
      wordCount: 900 + index * 65,
      readingTime: 4 + (index % 6),
      coverImage: 'https://images.unsplash.com/photo-1499750310107-5fef28a66643?auto=format&fit=crop&w=1200&q=80',
      isPinned: index < 2,
    }
  })
}

let adminPosts = createMockPosts()
let adminTags: AdminTagRecord[] = createInitialMockAdminTags()
let adminCategories: AdminCategoryRecord[] = createInitialMockAdminCategories()
let adminAssets: AdminAssetRecord[] = [
  {
    id: 1,
    title: 'StarForum',
    fileName: 'StarForum.png',
    fileUrl: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1200&q=80',
    thumbnailUrl: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=320&q=80',
    mimeType: 'image/png',
    fileSizeLabel: '428 KB',
    author: adminAuthor,
    uploadedTo: 'StarForum：一个为 Flarum 而生的跨平台客户端',
    commentCount: 0,
    uploadedAt: '2026-02-21T11:20:00Z',
    alt: 'StarForum cover',
    description: '',
  },
  {
    id: 2,
    title: 'image',
    fileName: 'image-2.png',
    fileUrl: 'https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=1200&q=80',
    thumbnailUrl: 'https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=320&q=80',
    mimeType: 'image/png',
    fileSizeLabel: '386 KB',
    author: adminAuthor,
    uploadedTo: 'StarForum：一个为 Flarum 而生的跨平台客户端',
    commentCount: 0,
    uploadedAt: '2026-02-21T11:05:00Z',
    alt: 'image 2',
    description: '',
  },
  {
    id: 3,
    title: 'image',
    fileName: 'image-1.png',
    fileUrl: 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1200&q=80',
    thumbnailUrl: 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=320&q=80',
    mimeType: 'image/png',
    fileSizeLabel: '412 KB',
    author: adminAuthor,
    uploadedTo: 'StarForum：一个为 Flarum 而生的跨平台客户端',
    commentCount: 0,
    uploadedAt: '2026-02-21T10:30:00Z',
    alt: 'image 1',
    description: '',
  },
  {
    id: 4,
    title: 'flutter-cover',
    fileName: 'flutter-cover-2.png',
    fileUrl: 'https://images.unsplash.com/photo-1461749280684-dccba630e2f6?auto=format&fit=crop&w=1200&q=80',
    thumbnailUrl: 'https://images.unsplash.com/photo-1461749280684-dccba630e2f6?auto=format&fit=crop&w=320&q=80',
    mimeType: 'image/png',
    fileSizeLabel: '501 KB',
    author: adminAuthor,
    uploadedTo: '用 Flutter 写论坛客户端：一次跨平台架构与性能实践',
    commentCount: 0,
    uploadedAt: '2026-02-19T13:10:00Z',
    alt: 'Flutter cover',
    description: '',
  },
  {
    id: 5,
    title: 'Gemini_Generated_Image',
    fileName: 'Gemini_Generated_Image_m9lgsem9lgsem9lg.png',
    fileUrl: 'https://images.unsplash.com/photo-1517180102446-f3ece451e9d8?auto=format&fit=crop&w=1200&q=80',
    thumbnailUrl: 'https://images.unsplash.com/photo-1517180102446-f3ece451e9d8?auto=format&fit=crop&w=320&q=80',
    mimeType: 'image/png',
    fileSizeLabel: '617 KB',
    author: adminAuthor,
    uploadedTo: '用 Flutter 写论坛客户端：一次跨平台架构与性能实践',
    commentCount: 0,
    uploadedAt: '2026-02-19T10:45:00Z',
    alt: 'Gemini generated image',
    description: '',
  },
  {
    id: 6,
    title: 'Gemini_Generated_Image',
    fileName: 'Gemini_Generated_Image_wjq98owjq98owjq9.png',
    fileUrl: 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?auto=format&fit=crop&w=1200&q=80',
    thumbnailUrl: 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?auto=format&fit=crop&w=320&q=80',
    mimeType: 'image/png',
    fileSizeLabel: '592 KB',
    author: adminAuthor,
    uploadedTo: '用 Flutter 写论坛客户端：一次跨平台架构与性能实践',
    commentCount: 0,
    uploadedAt: '2026-02-19T09:20:00Z',
    alt: 'Gemini generated image 2',
    description: '',
  },
  {
    id: 7,
    title: 'avatar',
    fileName: 'avatar.jpg',
    fileUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=1200&q=80',
    thumbnailUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=320&q=80',
    mimeType: 'image/jpeg',
    fileSizeLabel: '152 KB',
    author: adminAuthor,
    uploadedTo: 'avatar',
    commentCount: 0,
    uploadedAt: '2025-12-14T08:30:00Z',
    alt: 'avatar',
    description: '',
  },
  {
    id: 8,
    title: 'cropped-54226073',
    fileName: 'cropped-54226073.jpg',
    fileUrl: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=80',
    thumbnailUrl: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=320&q=80',
    mimeType: 'image/jpeg',
    fileSizeLabel: '101 KB',
    author: adminAuthor,
    uploadedTo: '54226073',
    commentCount: 0,
    uploadedAt: '2025-12-14T07:50:00Z',
    alt: 'site icon',
    description: '',
  },
]
let adminUsers: AdminUserRecord[] = [
  {
    id: 1,
    username: 'admin',
    displayName: '飞在天上的海星',
    email: 'admin@example.com',
    role: 'admin',
    postCount: 5,
    twoFactorEnabled: false,
    lastLoginAt: '2026-03-13T19:36:00+08:00',
    avatar: '/placeholder-avatar.svg',
    gender: 'unknown',
    bio: '维护站点配置、内容发布和后台模块，平时主要写前端工程和产品设计相关内容。',
  },
  {
    id: 2,
    username: 'user',
    displayName: 'Normal Cube',
    email: 'user@example.com',
    role: 'user',
    postCount: 3,
    twoFactorEnabled: false,
    lastLoginAt: '2026-03-13T17:12:00+08:00',
    avatar: '/placeholder-avatar.svg',
    gender: 'unknown',
    bio: '一个长期写作中的普通用户，关注前端、体验设计和个人工作流。',
  },
  {
    id: 3,
    username: 'editor',
    displayName: '写作协作者',
    email: 'editor@example.com',
    role: 'editor',
    postCount: 2,
    twoFactorEnabled: true,
    lastLoginAt: '2026-03-12T21:20:00+08:00',
    avatar: '/placeholder-avatar.svg',
    gender: 'unknown',
    bio: '协助内容校对和整理分类的编辑用户。',
  },
]
const editorDraftStorageKey = 'cashew:admin-post-editor-drafts'

function delay<T>(value: T, timeout = 180): Promise<T> {
  return new Promise((resolve) => {
    window.setTimeout(() => resolve(value), timeout)
  })
}

function readStoredEditorDrafts(): AdminPostEditorRecord[] {
  if (typeof window === 'undefined') {
    return []
  }

  const raw = window.localStorage.getItem(editorDraftStorageKey)
  if (!raw) {
    return []
  }

  try {
    return JSON.parse(raw) as AdminPostEditorRecord[]
  } catch {
    window.localStorage.removeItem(editorDraftStorageKey)
    return []
  }
}

function persistEditorDrafts(records: AdminPostEditorRecord[]) {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.setItem(editorDraftStorageKey, JSON.stringify(records))
}

function deleteStoredEditorDrafts(ids: number[]) {
  const idSet = new Set(ids)
  persistEditorDrafts(readStoredEditorDrafts().filter((record) => !record.id || !idSet.has(record.id)))
}

function createEditorRecordFromPost(post: AdminPostRecord): AdminPostEditorRecord {
  return {
    id: post.id,
    title: post.title,
    slug: post.slug,
    desc: post.desc,
    coverImage: post.coverImage,
    category: post.category,
    tags: [...post.tags],
    content: '',
    state: post.state === 'public' ? 'public' : 'private',
    allowComment: true,
  }
}

function getVisiblePosts() {
  const withCommentCount = adminPosts
    .filter((post) => post.state !== 'deleted')
    .map((post) => ({
      ...post,
      commentCount: getMockCommentCountBySlug(post.slug) || getMockCommentCountByTitle(post.title),
    }))

  if (authState.isAdmin) {
    return withCommentCount
  }

  const username = authState.user?.username
  return withCommentCount.filter((post) => post.author.username === username)
}

export async function getMockAdminPosts(params: AdminPostListParams): Promise<AdminPostListResponse> {
  const normalized = params.keyword?.trim().toLowerCase() ?? ''
  const filtered = getVisiblePosts().filter((post) => {
    if (params.state && params.state !== 'all' && post.state !== params.state) {
      return false
    }

    if (!normalized) {
      return true
    }

    return [post.title, post.desc, post.author.displayName, post.category, post.tags.join(' '), post.slug]
      .join(' ')
      .toLowerCase()
      .includes(normalized)
  })

  const start = (params.page - 1) * params.pageSize
  return delay({
    list: filtered.slice(start, start + params.pageSize),
    total: filtered.length,
    page: params.page,
    pageSize: params.pageSize,
  })
}

export async function getMockAdminPostById(id: number): Promise<AdminPostRecord | null> {
  const row = adminPosts.find((post) => post.id === id)
  if (!row) {
    return delay(null)
  }

  if (!authState.isAdmin && row.author.username !== authState.user?.username) {
    return delay(null)
  }

  return delay(row)
}

export async function getMockAdminPostEditorRecord(id?: number | null): Promise<AdminPostEditorRecord> {
  if (!id) {
    return delay({
      id: null,
      title: '',
      slug: '',
      desc: '',
      coverImage: '',
      category: '',
      tags: [],
      content: '',
      state: 'private',
      allowComment: true,
    })
  }

  const stored = readStoredEditorDrafts().find((record) => record.id === id)
  if (stored) {
    return delay(stored)
  }

  const post = adminPosts.find((item) => item.id === id)
  if (post) {
    const publicPost = await getMockPostById(id)
    const record = createEditorRecordFromPost(post)
    return delay({
      ...record,
      content: publicPost?.content || record.content,
    })
  }

  return delay({
    id: null,
    title: '',
    slug: '',
    desc: '',
    coverImage: '',
    category: '',
    tags: [],
    content: '',
    state: 'private',
    allowComment: true,
  })
}

export async function saveMockAdminPostEditorRecord(payload: AdminPostEditorRecord): Promise<AdminPostEditorRecord> {
  const drafts = readStoredEditorDrafts()
  const nextId = payload.id ?? Math.max(1000, ...adminPosts.map((post) => post.id), ...drafts.map((draft) => draft.id ?? 0)) + 1
  const nextRecord: AdminPostEditorRecord = {
    ...payload,
    id: nextId,
    slug: payload.slug || `post-${nextId}`,
  }

  const nextDrafts = drafts.some((draft) => draft.id === nextId)
    ? drafts.map((draft) => (draft.id === nextId ? nextRecord : draft))
    : [nextRecord, ...drafts]
  persistEditorDrafts(nextDrafts)

  const author = authState.user?.username === 'user' ? userAuthor : adminAuthor
  const title = nextRecord.title.trim() || '未命名文章'
  const desc = nextRecord.desc.trim() || '这是一篇正在编辑中的文章。'
  const existingPostIndex = adminPosts.findIndex((post) => post.id === nextId)
  const nextPost: AdminPostRecord = {
    id: nextId,
    title,
    slug: nextRecord.slug,
    desc,
    author,
    category: nextRecord.category || '未分类',
    tags: nextRecord.tags.length > 0 ? nextRecord.tags : ['Draft'],
    state: nextRecord.state,
    auditStatus: nextRecord.state === 'public' ? 'approved' : 'pending',
    publishedAt: existingPostIndex >= 0 ? adminPosts[existingPostIndex]!.publishedAt : new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    viewCount: existingPostIndex >= 0 ? adminPosts[existingPostIndex]!.viewCount : 0,
    likeCount: existingPostIndex >= 0 ? adminPosts[existingPostIndex]!.likeCount : 0,
    commentCount: existingPostIndex >= 0 ? adminPosts[existingPostIndex]!.commentCount : 0,
    wordCount: Math.max(1, nextRecord.content.trim().length),
    readingTime: Math.max(1, Math.ceil(nextRecord.content.trim().length / 400)),
    coverImage: nextRecord.coverImage || 'https://images.unsplash.com/photo-1499750310107-5fef28a66643?auto=format&fit=crop&w=1200&q=80',
    isPinned: existingPostIndex >= 0 ? adminPosts[existingPostIndex]!.isPinned : false,
  }

  if (existingPostIndex >= 0) {
    adminPosts = adminPosts.map((post) => (post.id === nextId ? nextPost : post))
  } else {
    adminPosts = [nextPost, ...adminPosts]
  }

  upsertMockSitePostFromAdmin(nextPost, nextRecord.content)

  return delay(nextRecord, 220)
}

export async function patchMockAdminPosts(ids: number[], nextState: AdminPostState): Promise<void> {
  if (nextState === 'deleted') {
    console.info('[mock-admin-posts] delete', { ids, beforeCount: adminPosts.length })
    adminPosts = adminPosts.filter((post) => !ids.includes(post.id))
    deleteStoredEditorDrafts(ids)
    removeMockSitePostsByIds(ids)
    console.info('[mock-admin-posts] delete:done', { ids, afterCount: adminPosts.length })
    await delay(undefined, 220)
    return
  }

  const updatedAt = new Date().toISOString()
  adminPosts = adminPosts.map((post) => (ids.includes(post.id)
    ? {
        ...post,
        state: nextState,
        auditStatus: nextState === 'private' ? 'pending' : post.auditStatus,
        updatedAt,
      }
    : post))
  adminPosts.filter((post) => ids.includes(post.id)).forEach((post) => {
    upsertMockSitePostFromAdmin(post)
  })

  await delay(undefined, 220)
}

export async function approveMockAdminPosts(ids: number[]): Promise<void> {
  const updatedAt = new Date().toISOString()
  adminPosts = adminPosts.map((post) => (ids.includes(post.id)
    ? {
        ...post,
        state: 'public',
        auditStatus: 'approved',
        updatedAt,
      }
    : post))
  adminPosts.filter((post) => ids.includes(post.id)).forEach((post) => {
    upsertMockSitePostFromAdmin(post)
  })

  await delay(undefined, 220)
}

export async function setMockAdminPostsPinned(ids: number[], isPinned: boolean): Promise<void> {
  if (!authState.isAdmin) {
    throw new Error('只有管理员可以管理置顶文章')
  }

  const changedIds: number[] = []
  console.info('[mock-admin-posts] pin', { ids, isPinned })
  adminPosts = adminPosts.map((post) => {
    if (!ids.includes(post.id)) {
      return post
    }

    const nextPinned = isPinned && post.state === 'public'
    changedIds.push(post.id)
    return { ...post, isPinned: nextPinned }
  })
  syncMockPinnedPosts(changedIds, isPinned)
  console.info('[mock-admin-posts] pin:done', {
    ids: changedIds,
    isPinned,
    pinnedPosts: adminPosts.filter((post) => post.isPinned).map((post) => post.id),
  })
  await delay(undefined, 220)
}

export async function deleteMockAdminPosts(ids: number[]): Promise<void> {
  console.info('[mock-admin-posts] delete-direct', { ids, beforeCount: adminPosts.length })
  adminPosts = adminPosts.filter((post) => !ids.includes(post.id))
  deleteStoredEditorDrafts(ids)
  removeMockSitePostsByIds(ids)
  console.info('[mock-admin-posts] delete-direct:done', { ids, afterCount: adminPosts.length })
  await delay(undefined, 220)
}

export async function getMockAdminTags(): Promise<AdminTagRecord[]> {
  adminTags = adminTags.map((tag) => {
    const siteTag = getSiteTaxonomyTags().find((item) => item.id === tag.id || item.slug === tag.slug || item.name === tag.name)
    return siteTag
      ? { ...tag, name: siteTag.name, slug: siteTag.slug, desc: siteTag.desc ?? tag.desc, postCount: siteTag.postCount }
      : tag
  })
  return delay([...adminTags].sort((left, right) => left.name.localeCompare(right.name, 'zh-CN')))
}

export async function createMockAdminTag(payload: Omit<AdminTagRecord, 'id' | 'postCount'>): Promise<AdminTagRecord> {
  const siteTag = createMockSiteTag(payload)
  const nextRecord: AdminTagRecord = { id: siteTag.id, name: siteTag.name, slug: siteTag.slug, desc: siteTag.desc ?? '', postCount: siteTag.postCount }

  adminTags = [...adminTags, nextRecord]
  return delay(nextRecord, 220)
}

export async function updateMockAdminTag(id: number, payload: Pick<AdminTagRecord, 'name' | 'slug' | 'desc'>): Promise<AdminTagRecord | null> {
  const siteTag = updateMockSiteTag(id, payload)
  let updatedRecord: AdminTagRecord | null = null
  adminTags = adminTags.map((tag) => {
    if (tag.id !== id) {
      return tag
    }

    updatedRecord = { ...tag, ...payload, postCount: siteTag?.postCount ?? tag.postCount }
    return updatedRecord
  })

  return delay(updatedRecord, 220)
}

export async function deleteMockAdminTags(ids: number[]): Promise<void> {
  adminTags = adminTags.filter((tag) => !ids.includes(tag.id))
  deleteMockSiteTags(ids)
  await delay(undefined, 220)
}

export async function getMockAdminCategories(): Promise<AdminCategoryRecord[]> {
  adminCategories = adminCategories.map((category) => {
    const siteCategory = getSiteTaxonomyCategories().find((item) => item.id === category.id || item.slug === category.slug || item.name === category.name)
    return siteCategory
      ? { ...category, name: siteCategory.name, slug: siteCategory.slug, desc: siteCategory.desc ?? category.desc, postCount: siteCategory.postCount }
      : category
  })
  const list = [...adminCategories].sort((left, right) => {
    if (left.level !== right.level) {
      return left.level - right.level
    }

    return left.name.localeCompare(right.name, 'zh-CN')
  })

  return delay(list)
}

export async function createMockAdminCategory(
  payload: Omit<AdminCategoryRecord, 'id' | 'postCount' | 'level' | 'parentName' | 'isDefault'>,
): Promise<AdminCategoryRecord> {
  const parent = payload.parentId ? adminCategories.find((item) => item.id === payload.parentId) ?? null : null
  const siteCategory = createMockSiteCategory(payload)
  const nextRecord: AdminCategoryRecord = {
    id: siteCategory.id,
    postCount: siteCategory.postCount,
    level: parent ? parent.level + 1 : 0,
    parentName: parent?.name,
    ...payload,
    name: siteCategory.name,
    slug: siteCategory.slug,
    desc: siteCategory.desc ?? payload.desc,
  }

  adminCategories = [...adminCategories, nextRecord]
  return delay(nextRecord, 220)
}

export async function updateMockAdminCategory(
  id: number,
  payload: Pick<AdminCategoryRecord, 'name' | 'slug' | 'desc' | 'parentId'>,
): Promise<AdminCategoryRecord | null> {
  const parent = payload.parentId ? adminCategories.find((item) => item.id === payload.parentId) ?? null : null
  const siteCategory = updateMockSiteCategory(id, payload)
  let updatedRecord: AdminCategoryRecord | null = null

  adminCategories = adminCategories.map((category) => {
    if (category.id !== id) {
      return category
    }

    updatedRecord = {
      ...category,
      ...payload,
      level: parent ? parent.level + 1 : 0,
      parentName: parent?.name,
      postCount: siteCategory?.postCount ?? category.postCount,
    }
    return updatedRecord
  })

  return delay(updatedRecord, 220)
}

export async function deleteMockAdminCategories(ids: number[]): Promise<void> {
  const deletableIds = ids.filter((id) => !adminCategories.find((category) => category.id === id)?.isDefault)
  const fallbackCategory = adminCategories.find((category) => category.isDefault)

  adminCategories = adminCategories
    .map((category) => (
      deletableIds.includes(category.parentId ?? -1)
        ? {
            ...category,
            parentId: null,
            parentName: undefined,
            level: 0,
          }
        : category
    ))
    .filter((category) => !deletableIds.includes(category.id))
  if (fallbackCategory) {
    deleteMockSiteCategories(deletableIds, {
      id: fallbackCategory.id,
      name: fallbackCategory.name,
      slug: fallbackCategory.slug,
    })
  }

  await delay(undefined, 220)
}

export async function getMockAdminComments(): Promise<AdminCommentRecord[]> {
  const adminComments = getMockAdminCommentsData()
  const visibleTitles = new Set(getVisiblePosts().map((post) => post.title))
  const visibleComments = authState.isAdmin
    ? adminComments
    : adminComments.filter((comment) => visibleTitles.has(comment.postTitle))

  return delay([...visibleComments].sort((left, right) => new Date(right.submittedAt).getTime() - new Date(left.submittedAt).getTime()))
}

export async function patchMockAdminComments(ids: number[], state: AdminCommentRecord['state']): Promise<void> {
  updateMockCommentsState(ids, state)
  await delay(undefined, 220)
}

export async function deleteMockAdminComments(ids: number[]): Promise<void> {
  deleteMockComments(ids)
  await delay(undefined, 220)
}

export async function getMockAdminAssets(): Promise<AdminAssetRecord[]> {
  const visibleAssets = authState.isAdmin
    ? adminAssets
    : adminAssets.filter((asset) => asset.author.username === authState.user?.username)

  return delay([...visibleAssets].sort((left, right) => new Date(right.uploadedAt).getTime() - new Date(left.uploadedAt).getTime()))
}

export async function getMockAdminAssetById(id: number): Promise<AdminAssetRecord | null> {
  const asset = adminAssets.find((item) => item.id === id) ?? null
  if (!asset) {
    return delay(null)
  }

  if (!authState.isAdmin && asset.author.username !== authState.user?.username) {
    return delay(null)
  }

  return delay(asset)
}

export async function deleteMockAdminAssets(ids: number[]): Promise<void> {
  adminAssets = adminAssets.filter((asset) => !ids.includes(asset.id))
  await delay(undefined, 220)
}

export async function getMockAdminUsers(): Promise<AdminUserRecord[]> {
  const visibleUsers = authState.isAdmin
    ? adminUsers
    : adminUsers.filter((user) => user.username === authState.user?.username)

  return delay([...visibleUsers].sort((left, right) => left.username.localeCompare(right.username, 'zh-CN')))
}

export async function getMockAdminDashboardSummary(): Promise<AdminDashboardSummary> {
  const visiblePosts = getVisiblePosts()
  const adminComments = getMockAdminCommentsData()
  const visibleComments = authState.isAdmin
    ? adminComments
    : adminComments.filter((comment) => visiblePosts.some((post) => post.title === comment.postTitle))
  const visibleAssets = authState.isAdmin
    ? adminAssets
    : adminAssets.filter((asset) => asset.author.username === authState.user?.username)

  return delay({
    stats: [
      { label: '文章数', value: String(visiblePosts.length) },
      { label: '草稿数', value: String(visiblePosts.filter((post) => post.state === 'private').length) },
      { label: '分类数', value: String(adminCategories.length) },
      { label: '标签数', value: String(adminTags.length) },
      { label: '评论数', value: String(visibleComments.length) },
      { label: '资源数', value: String(visibleAssets.length) },
    ],
    recentPosts: [...visiblePosts]
      .sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime())
      .slice(0, 3)
      .map((post) => post.title),
    recentComments: [...visibleComments]
      .sort((left, right) => new Date(right.submittedAt).getTime() - new Date(left.submittedAt).getTime())
      .slice(0, 3)
      .map((comment) => `${comment.author}：${comment.content}`),
  }, 160)
}

export async function getMockAdminUserById(id: number): Promise<AdminUserRecord | null> {
  const visibleUsers = authState.isAdmin
    ? adminUsers
    : adminUsers.filter((user) => user.username === authState.user?.username)
  return delay(visibleUsers.find((user) => user.id === id) ?? null)
}

export async function createMockAdminUser(
  payload: Pick<AdminUserRecord, 'username' | 'displayName' | 'email' | 'role' | 'avatar' | 'gender' | 'bio'>,
): Promise<AdminUserRecord> {
  if (!authState.isAdmin) {
    throw new Error('只有管理员可以新增用户')
  }

  const normalizedUsername = payload.username.trim()
  if (adminUsers.some((user) => user.username === normalizedUsername)) {
    throw new Error('用户名已存在')
  }

  const nextUser: AdminUserRecord = {
    id: Math.max(0, ...adminUsers.map((user) => user.id)) + 1,
    username: normalizedUsername,
    displayName: payload.displayName.trim(),
    email: payload.email.trim(),
    role: payload.role,
    postCount: 0,
    twoFactorEnabled: false,
    lastLoginAt: new Date().toISOString(),
    avatar: payload.avatar.trim() || '/placeholder-avatar.svg',
    gender: payload.gender,
    bio: payload.bio.trim(),
  }

  adminUsers = [nextUser, ...adminUsers]
  return delay(nextUser, 220)
}

export async function updateMockAdminUser(
  id: number,
  payload: Pick<AdminUserRecord, 'displayName' | 'email' | 'role' | 'avatar' | 'gender' | 'bio'>,
): Promise<AdminUserRecord | null> {
  let updated: AdminUserRecord | null = null
  adminUsers = adminUsers.map((user) => {
    if (user.id !== id) {
      return user
    }

    updated = { ...user, ...payload }
    return updated
  })

  return delay(updated, 220)
}

export async function deleteMockAdminUsers(ids: number[]): Promise<void> {
  if (!authState.isAdmin) {
    throw new Error('只有管理员可以删除用户')
  }

  adminUsers = adminUsers.filter((user) => !ids.includes(user.id))
  await delay(undefined, 220)
}

export async function toggleMockAdminUserTwoFactor(id: number): Promise<AdminUserRecord | null> {
  let updated: AdminUserRecord | null = null
  adminUsers = adminUsers.map((user) => {
    if (user.id !== id) {
      return user
    }

    updated = { ...user, twoFactorEnabled: !user.twoFactorEnabled }
    return updated
  })

  return delay(updated, 220)
}
