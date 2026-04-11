import { computed, ref, watch } from 'vue'

import {
  approveAdminPosts,
  getAdminPostById,
  getAdminPosts,
  setAdminPostsPinned,
  updateAdminPostState,
} from '@/controllers/adminController'
import { authState } from '@/stores/authStore'
import type { AdminPostRecord, AdminPostState } from '@/types/admin'

type PendingAction = 'delete' | 'approve' | 'pin' | 'unpin'

const actionConfig: Record<PendingAction, { title: string; description: string; confirmText: string }> = {
  delete: {
    title: '确认删除',
    description: '删除后文章会从后台和当前前台数据集中移除。',
    confirmText: '确认删除',
  },
  approve: {
    title: '确认审核通过',
    description: '审核通过后会把待审核文章切换成 public 状态。',
    confirmText: '确认通过',
  },
  pin: {
    title: '确认置顶',
    description: '置顶后文章会同步进入首页置顶区。',
    confirmText: '确认置顶',
  },
  unpin: {
    title: '取消置顶',
    description: '取消置顶后文章会从首页置顶区移除，但文章仍然保留。',
    confirmText: '确认取消',
  },
}

export function useAdminPostsPage() {
  const rows = ref<AdminPostRecord[]>([])
  const loading = ref(false)
  const errorMessage = ref('')
  const keyword = ref('')
  const stateFilter = ref<AdminPostState | 'all'>('all')
  const selectedIds = ref<number[]>([])
  const page = ref(1)
  const pageSize = 8
  const total = ref(0)
  const detailOpen = ref(false)
  const detailLoading = ref(false)
  const activeDetail = ref<AdminPostRecord | null>(null)
  const confirmOpen = ref(false)
  const pendingAction = ref<PendingAction | null>(null)
  const pendingIds = ref<number[]>([])
  const actionLoading = ref(false)
  const jumpPageInput = ref('1')

  const totalPages = computed(() => Math.max(1, Math.ceil(total.value / pageSize)))
  const hasSelection = computed(() => selectedIds.value.length > 0)
  const selectedCount = computed(() => selectedIds.value.length)
  const pageNumbers = computed(() => {
    const start = Math.max(1, page.value - 2)
    const end = Math.min(totalPages.value, start + 4)
    return Array.from({ length: end - start + 1 }, (_, index) => start + index)
  })
  const confirmMeta = computed(() => (pendingAction.value ? actionConfig[pendingAction.value] : null))

  async function load() {
    loading.value = true
    errorMessage.value = ''

    try {
      const response = await getAdminPosts({
        page: page.value,
        pageSize,
        keyword: keyword.value,
        state: stateFilter.value,
      })
      rows.value = response.list
      total.value = response.total
      jumpPageInput.value = String(response.page)
      selectedIds.value = selectedIds.value.filter((id) => rows.value.some((row) => row.id === id))
    } catch (error) {
      errorMessage.value = error instanceof Error ? error.message : '文章列表加载失败'
    } finally {
      loading.value = false
    }
  }

  async function reloadFromFirstPage() {
    page.value = 1
    await load()
  }

  function toggleSelectAll() {
    if (selectedIds.value.length === rows.value.length) {
      selectedIds.value = []
      return
    }

    selectedIds.value = rows.value.map((row) => row.id)
  }

  function toggleSelection(id: number) {
    selectedIds.value = selectedIds.value.includes(id)
      ? selectedIds.value.filter((value) => value !== id)
      : [...selectedIds.value, id]
  }

  async function openDetail(id: number) {
    detailOpen.value = true
    detailLoading.value = true
    activeDetail.value = null

    try {
      activeDetail.value = await getAdminPostById(id)
    } finally {
      detailLoading.value = false
    }
  }

  function requestAction(action: PendingAction, ids: number[]) {
    if (!ids.length) {
      return
    }

    pendingAction.value = action
    pendingIds.value = ids
    confirmOpen.value = true
  }

  function closeConfirm() {
    confirmOpen.value = false
    pendingAction.value = null
    pendingIds.value = []
  }

  async function confirmAction() {
    if (!pendingAction.value || !pendingIds.value.length) {
      return
    }

    actionLoading.value = true

    try {
      if (pendingAction.value === 'delete') {
        await updateAdminPostState(pendingIds.value, 'deleted')
        if (activeDetail.value && pendingIds.value.includes(activeDetail.value.id)) {
          detailOpen.value = false
          activeDetail.value = null
        }
      } else if (pendingAction.value === 'approve') {
        await approveAdminPosts(pendingIds.value)
      } else {
        await setAdminPostsPinned(pendingIds.value, pendingAction.value === 'pin')
      }

      closeConfirm()
      await load()
      if (activeDetail.value) {
        activeDetail.value = await getAdminPostById(activeDetail.value.id)
      }
    } finally {
      actionLoading.value = false
    }
  }

  async function goToPage(nextPage: number) {
    if (nextPage < 1 || nextPage > totalPages.value || nextPage === page.value) {
      return
    }

    page.value = nextPage
    await load()
  }

  async function jumpToPage() {
    const nextPage = Number(jumpPageInput.value)
    if (!Number.isFinite(nextPage)) {
      jumpPageInput.value = String(page.value)
      return
    }

    await goToPage(Math.min(totalPages.value, Math.max(1, nextPage)))
  }

  function formatDate(value: string) {
    return new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
  }

  function stateLabel(state: AdminPostState) {
    if (state === 'public') return '公开'
    if (state === 'private') return '私有'
    if (state === 'archived') return '归档'
    return '已删除'
  }

  function auditLabel(post: AdminPostRecord) {
    return post.auditStatus === 'approved' ? '已审核' : '待审核'
  }

  function shouldShowApprove(post: AdminPostRecord) {
    return authState.isAdmin && post.auditStatus !== 'approved'
  }

  function shouldShowPin(post: AdminPostRecord) {
    return authState.isAdmin && post.state === 'public' && !post.isPinned
  }

  function shouldShowUnpin(post: AdminPostRecord) {
    return authState.isAdmin && post.isPinned
  }

  watch([keyword, stateFilter], () => {
    void reloadFromFirstPage()
  })

  void load()

  return {
    rows,
    loading,
    errorMessage,
    keyword,
    stateFilter,
    selectedIds,
    page,
    total,
    totalPages,
    pageNumbers,
    jumpPageInput,
    hasSelection,
    selectedCount,
    detailOpen,
    detailLoading,
    activeDetail,
    confirmOpen,
    confirmMeta,
    pendingIds,
    actionLoading,
    load,
    toggleSelectAll,
    toggleSelection,
    openDetail,
    requestAction,
    closeConfirm,
    confirmAction,
    goToPage,
    jumpToPage,
    formatDate,
    stateLabel,
    auditLabel,
    shouldShowApprove,
    shouldShowPin,
    shouldShowUnpin,
    authState,
  }
}
