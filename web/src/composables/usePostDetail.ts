import { computed, onMounted, ref, watch, type Ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { logout } from '@/controllers/authController'
import { loadArticleComments, loadArticleContext, submitArticleComment } from '@/controllers/publicController'
import { authState } from '@/stores/authStore'
import type { ArticleComment, ArticleContext, HomePostCard } from '@/types/content'
import { renderMarkdown } from '@/utils/markdown'

export function usePostDetail(articleId: Ref<number | null>, previewPost: Ref<HomePostCard | null | undefined>) {
  const route = useRoute()
  const router = useRouter()
  const commentsPageSize = 5
  const post = ref<HomePostCard | null>(null)
  const loading = ref(true)
  const articleContext = ref<ArticleContext | null>(null)
  const articleComments = ref<ArticleComment[]>([])
  const submitError = ref('')
  const replyValue = ref('')
  const activeReplyId = ref<number | null>(null)
  const replyDraft = ref('')
  const commentsPage = ref(1)

  const activePost = computed(() => post.value ?? previewPost.value ?? null)
  const comments = computed(() => articleComments.value)
  const commentsTotalPages = computed(() => Math.max(1, Math.ceil(comments.value.length / commentsPageSize)))
  const pagedComments = computed(() => {
    const start = (commentsPage.value - 1) * commentsPageSize
    return comments.value.slice(start, start + commentsPageSize)
  })
  const previousPost = computed(() => articleContext.value?.previous ?? null)
  const nextPost = computed(() => articleContext.value?.next ?? null)
  const hasPostNavigation = computed(() => previousPost.value !== null || nextPost.value !== null)
  const formattedDate = computed(() =>
    activePost.value
      ? new Intl.DateTimeFormat('zh-CN', { dateStyle: 'long' }).format(new Date(activePost.value.publishedAt))
      : '',
  )
  const isLoggedIn = computed(() => authState.isLoggedIn)
  const currentUser = computed(() => authState.user)
  const renderedContent = computed(() => renderMarkdown(activePost.value?.content ?? ''))

  function syncCommentCount() {
    if (post.value) {
      post.value = {
        ...post.value,
        commentCount: articleComments.value.length,
      }
    }
  }

  async function reloadComments() {
    if (!articleId.value) {
      articleComments.value = []
      return
    }

    articleComments.value = await loadArticleComments(articleId.value)
    syncCommentCount()
    commentsPage.value = commentsTotalPages.value
  }

  async function load() {
    loading.value = true
    submitError.value = ''

    try {
      if (!articleId.value) {
        post.value = null
        articleContext.value = null
        articleComments.value = []
        return
      }

      const vm = await loadArticleContext(articleId.value)
      post.value = vm.post
      articleContext.value = vm.context
      articleComments.value = vm.context.comments
      syncCommentCount()
      commentsPage.value = 1
    } finally {
      loading.value = false
    }
  }

  async function goToLogin() {
    await router.push({
      name: 'login',
      query: {
        redirect: route.fullPath,
      },
    })
  }

  function logoutCurrentUser() {
    logout()
  }

  function openReply(commentId: number) {
    if (!isLoggedIn.value) {
      void goToLogin()
      return
    }

    activeReplyId.value = activeReplyId.value === commentId ? null : commentId
    replyDraft.value = ''
  }

  async function submitComment() {
    if (!isLoggedIn.value || !replyValue.value.trim() || !currentUser.value) {
      return
    }

    submitError.value = ''

    try {
      if (!articleId.value) {
        throw new Error('文章不存在')
      }

      await submitArticleComment(articleId.value, replyValue.value.trim())
      await reloadComments()
      replyValue.value = ''
    } catch (error) {
      submitError.value = error instanceof Error ? error.message : '评论提交失败'
    }
  }

  async function submitReply(commentId: number, _replyTo: string) {
    if (!isLoggedIn.value || !replyDraft.value.trim() || !currentUser.value) {
      return
    }

    submitError.value = ''

    try {
      if (!articleId.value) {
        throw new Error('文章不存在')
      }

      await submitArticleComment(articleId.value, replyDraft.value.trim(), commentId)
      await reloadComments()
      activeReplyId.value = null
      replyDraft.value = ''
    } catch (error) {
      submitError.value = error instanceof Error ? error.message : '回复提交失败'
    }
  }

  function goToPreviousCommentsPage() {
    commentsPage.value = Math.max(1, commentsPage.value - 1)
  }

  function goToNextCommentsPage() {
    commentsPage.value = Math.min(commentsTotalPages.value, commentsPage.value + 1)
  }

  watch(() => route.params.id, () => {
    void load()
  })

  onMounted(() => {
    void load()
  })

  return {
    loading,
    replyValue,
    activeReplyId,
    replyDraft,
    isLoggedIn,
    activePost,
    comments,
    pagedComments,
    commentsPage,
    commentsTotalPages,
    previousPost,
    nextPost,
    hasPostNavigation,
    formattedDate,
    currentUser,
    renderedContent,
    submitError,
    goToLogin,
    logoutCurrentUser,
    openReply,
    submitComment,
    submitReply,
    goToPreviousCommentsPage,
    goToNextCommentsPage,
  }
}
