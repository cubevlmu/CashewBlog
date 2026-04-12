import { computed, ref } from 'vue'

import { deleteAdminComments, getAdminComments, updateAdminCommentsState } from '@/controllers/adminController'
import { authState } from '@/stores/authStore'
import type { AdminCommentRecord } from '@/types/admin'

type PendingAction = 'approve' | 'restore' | 'hide' | 'delete'

export function useAdminCommentsPage() {
  const comments = ref<AdminCommentRecord[]>([])
  const loading = ref(false)
  const errorMessage = ref('')
  const selectedIds = ref<number[]>([])
  const confirmOpen = ref(false)
  const pendingAction = ref<PendingAction | null>(null)
  const saving = ref(false)
  const page = ref(1)
  const pageSize = 5

  const sortedComments = computed(() => [...comments.value].sort((left, right) => new Date(right.submittedAt).getTime() - new Date(left.submittedAt).getTime()))
  const pagedComments = computed(() => {
    const start = (page.value - 1) * pageSize
    return sortedComments.value.slice(start, start + pageSize)
  })
  const hasSelection = computed(() => selectedIds.value.length > 0)
  const totalCount = computed(() => comments.value.length)
  const totalPages = computed(() => Math.max(1, Math.ceil(sortedComments.value.length / pageSize)))

  async function load() {
    loading.value = true
    errorMessage.value = ''

    try {
      comments.value = await getAdminComments()
      selectedIds.value = selectedIds.value.filter((id) => comments.value.some((comment) => comment.id === id))
      page.value = Math.min(page.value, Math.max(1, Math.ceil(comments.value.length / pageSize)))
    } catch (error) {
      errorMessage.value = error instanceof Error ? error.message : '评论列表加载失败'
    } finally {
      loading.value = false
    }
  }

  function toggleSelectAll() {
    selectedIds.value = selectedIds.value.length === pagedComments.value.length ? [] : pagedComments.value.map((comment) => comment.id)
  }

  function toggleSelection(id: number) {
    selectedIds.value = selectedIds.value.includes(id)
      ? selectedIds.value.filter((value) => value !== id)
      : [...selectedIds.value, id]
  }

  function requestAction(action: PendingAction, ids: number[]) {
    if (!ids.length) return
    selectedIds.value = ids
    pendingAction.value = action
    confirmOpen.value = true
  }

  async function confirmAction() {
    if (!pendingAction.value || !selectedIds.value.length) return

    saving.value = true
    try {
      if (pendingAction.value === 'delete') {
        await deleteAdminComments(selectedIds.value)
      } else if (pendingAction.value === 'approve' || pendingAction.value === 'restore') {
        await updateAdminCommentsState(selectedIds.value, 'approved')
      } else {
        await updateAdminCommentsState(selectedIds.value, 'hidden')
      }

      confirmOpen.value = false
      pendingAction.value = null
      selectedIds.value = []
      await load()
    } finally {
      saving.value = false
    }
  }

  function goToPage(nextPage: number) {
    page.value = Math.min(totalPages.value, Math.max(1, nextPage))
    selectedIds.value = []
  }

  function stateLabel(state: AdminCommentRecord['state']) {
    if (state === 'approved') return '已通过'
    if (state === 'pending') return '待审核'
    return '已隐藏'
  }

  function formatDate(value: string) {
    return new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
  }

  void load()

  return {
    comments,
    sortedComments,
    pagedComments,
    loading,
    errorMessage,
    selectedIds,
    confirmOpen,
    pendingAction,
    saving,
    hasSelection,
    page,
    totalCount,
    totalPages,
    load,
    toggleSelectAll,
    toggleSelection,
    requestAction,
    confirmAction,
    stateLabel,
    formatDate,
    goToPage,
    authState,
  }
}
