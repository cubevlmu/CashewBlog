import { mapBlogToAdminEditorRecord } from '@/mappers/adminApi'
import { assetUrl } from '@/mappers/assetUrl'
import type { ApiBlogDetail, ApiCategoryItem, ApiTagItem } from '@/types/api'
import type { AdminCategoryRecord, AdminPostEditorRecord, AdminTagRecord } from '@/types/admin'
import type { EditorForm } from '@/types/forms'

export function createEmptyEditorForm(): EditorForm {
  return {
    id: null,
    title: '',
    slug: '',
    summary: '',
    contentMarkdown: '',
    coverImage: '',
    titleImageId: null,
    categoryId: null,
    tagIds: [],
    allowComment: true,
    isTop: false,
    state: 'draft',
  }
}

export function mapApiBlogDetailToEditorForm(blog?: ApiBlogDetail | null): EditorForm {
  if (!blog) {
    return createEmptyEditorForm()
  }

  return {
    id: blog.id,
    title: blog.title,
    slug: blog.slug,
    summary: blog.summary,
    contentMarkdown: blog.content_markdown,
    coverImage: assetUrl(blog.title_image),
    titleImageId: blog.title_image?.id ?? null,
    categoryId: blog.category?.id ?? null,
    tagIds: blog.tags.map((tag) => tag.id),
    allowComment: blog.allow_comment,
    isTop: blog.is_top,
    state: blog.state === 'public' ? 'public' : blog.state === 'private' || blog.state === 'pending' ? 'private' : 'draft',
  }
}

export function mapEditorFormToAdminEditorRecord(
  form: EditorForm,
  categories: AdminCategoryRecord[],
  tags: AdminTagRecord[],
): AdminPostEditorRecord {
  return {
    id: form.id,
    title: form.title,
    slug: form.slug,
    desc: form.summary,
    coverImage: form.coverImage,
    category: categories.find((item) => item.id === form.categoryId)?.name ?? '',
    tags: tags.filter((item) => form.tagIds.includes(item.id)).map((item) => item.name),
    content: form.contentMarkdown,
    state: form.state === 'public' ? 'public' : 'private',
    allowComment: form.allowComment,
  }
}

export function mapSavedBlogToAdminEditorRecord(blog: ApiBlogDetail | null | undefined) {
  return mapBlogToAdminEditorRecord(blog)
}

export function mapApiTagToAdminTagOption(tag: ApiTagItem): AdminTagRecord {
  return {
    id: tag.id,
    name: tag.name,
    slug: tag.slug,
    desc: tag.desc || '',
    postCount: tag.post_count ?? 0,
  }
}

export function mapApiCategoryToAdminCategoryOption(category: ApiCategoryItem): AdminCategoryRecord {
  return {
    id: category.id,
    name: category.name,
    slug: category.slug,
    desc: category.desc || '',
    postCount: category.post_count ?? 0,
    parentId: category.parent?.id || null,
    parentName: category.parent?.name || '',
    level: category.parent?.id ? 2 : 1,
  }
}
