import type { BlogState } from '@/types/api'

export interface EditorForm {
  id: number | null
  title: string
  slug: string
  summary: string
  contentMarkdown: string
  coverImage: string
  titleImageId: number | null
  categoryId: number | null
  tagIds: number[]
  allowComment: boolean
  isTop: boolean
  state: Extract<BlogState, 'draft' | 'public' | 'private'>
}
