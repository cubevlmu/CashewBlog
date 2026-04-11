import { mapApiCommentsToArticleComments } from '@/mappers/contentApi'
import type { ApiCommentItem } from '@/types/api'

export function mapApiCommentListToArticleComments(comments: ApiCommentItem[]) {
  return mapApiCommentsToArticleComments(comments)
}
