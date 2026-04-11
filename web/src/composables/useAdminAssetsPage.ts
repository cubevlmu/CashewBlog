import { computed, ref } from 'vue'

import { deleteAdminAssets, getAdminAssetById, getAdminAssets } from '@/controllers/adminController'
import { authState } from '@/stores/authStore'
import type { AdminAssetRecord } from '@/types/admin'

type AssetSortKey = 'uploadedAt' | 'title' | 'author' | 'uploadedTo' | 'commentCount'

export function useAdminAssetsPage() {
  const assets = ref<AdminAssetRecord[]>([])
  const loading = ref(false)
  const errorMessage = ref('')
  const selectedIds = ref<number[]>([])
  const keyword = ref('')
  const typeFilter = ref<'all' | 'image' | 'file'>('image')
  const sortKey = ref<AssetSortKey>('uploadedAt')
  const sortDirection = ref<'asc' | 'desc'>('desc')
  const page = ref(1)
  const pageSize = 8
  const detailOpen = ref(false)
  const detailLoading = ref(false)
  const activeDetail = ref<AdminAssetRecord | null>(null)
  const confirmOpen = ref(false)
  const saving = ref(false)
  const actionScope = ref<'single' | 'batch'>('single')

  const filteredAssets = computed(() => {
    const normalized = keyword.value.trim().toLowerCase()
    return assets.value.filter((asset) => {
      if (typeFilter.value === 'image' && !asset.mimeType.startsWith('image/')) return false
      if (typeFilter.value === 'file' && asset.mimeType.startsWith('image/')) return false
      if (!normalized) return true
      return [asset.title, asset.fileName, asset.author.displayName, asset.uploadedTo ?? '', asset.description ?? '']
        .join(' ')
        .toLowerCase()
        .includes(normalized)
    })
  })

  const sortedAssets = computed(() => [...filteredAssets.value].sort((left, right) => {
    if (sortKey.value === 'uploadedAt') {
      return sortDirection.value === 'desc'
        ? new Date(right.uploadedAt).getTime() - new Date(left.uploadedAt).getTime()
        : new Date(left.uploadedAt).getTime() - new Date(right.uploadedAt).getTime()
    }
    if (sortKey.value === 'commentCount') {
      return sortDirection.value === 'desc' ? right.commentCount - left.commentCount : left.commentCount - right.commentCount
    }
    const leftValue = sortKey.value === 'author' ? left.author.displayName : left[sortKey.value] ?? ''
    const rightValue = sortKey.value === 'author' ? right.author.displayName : right[sortKey.value] ?? ''
    const result = String(leftValue).localeCompare(String(rightValue), 'zh-CN')
    return sortDirection.value === 'desc' ? -result : result
  }))

  const totalCount = computed(() => sortedAssets.value.length)
  const totalPages = computed(() => Math.max(1, Math.ceil(totalCount.value / pageSize)))
  const pagedAssets = computed(() => {
    const start = (page.value - 1) * pageSize
    return sortedAssets.value.slice(start, start + pageSize)
  })
  const hasSelection = computed(() => selectedIds.value.length > 0)

  async function load() {
    loading.value = true
    errorMessage.value = ''
    try {
      assets.value = await getAdminAssets()
      selectedIds.value = selectedIds.value.filter((id) => assets.value.some((asset) => asset.id === id))
      page.value = Math.min(page.value, totalPages.value)
    } catch (error) {
      errorMessage.value = error instanceof Error ? error.message : '资源列表加载失败'
    } finally {
      loading.value = false
    }
  }

  function updateSort(nextKey: AssetSortKey) {
    if (sortKey.value === nextKey) {
      sortDirection.value = sortDirection.value === 'asc' ? 'desc' : 'asc'
    } else {
      sortKey.value = nextKey
      sortDirection.value = nextKey === 'uploadedAt' || nextKey === 'commentCount' ? 'desc' : 'asc'
    }
  }

  function goToPage(nextPage: number) {
    page.value = Math.min(totalPages.value, Math.max(1, nextPage))
    selectedIds.value = []
  }

  function toggleSelectAll() {
    selectedIds.value = selectedIds.value.length === pagedAssets.value.length ? [] : pagedAssets.value.map((asset) => asset.id)
  }

  function toggleSelection(id: number) {
    selectedIds.value = selectedIds.value.includes(id)
      ? selectedIds.value.filter((value) => value !== id)
      : [...selectedIds.value, id]
  }

  async function openDetail(id: number) {
    detailOpen.value = true
    detailLoading.value = true
    try {
      activeDetail.value = await getAdminAssetById(id)
    } finally {
      detailLoading.value = false
    }
  }

  function requestDelete(ids: number[], scope: 'single' | 'batch' = 'single') {
    if (!ids.length) return
    selectedIds.value = ids
    actionScope.value = scope
    confirmOpen.value = true
  }

  async function confirmDelete() {
    if (!selectedIds.value.length) return
    saving.value = true
    try {
      await deleteAdminAssets(selectedIds.value)
      confirmOpen.value = false
      detailOpen.value = false
      activeDetail.value = null
      selectedIds.value = []
      await load()
    } finally {
      saving.value = false
    }
  }

  function sortMeta(key: AssetSortKey) {
    const isActive = sortKey.value === key
    const label = isActive ? (sortDirection.value === 'asc' ? '升序排列。' : '降序排列。') : '升序排列。'
    return `${isActive ? '表格按当前列排序。' : '点击按当前列排序。'} ${label}`
  }

  function formatDate(value: string) {
    return new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium' }).format(new Date(value))
  }

  function formatDateTime(value: string) {
    return new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
  }

  async function copyUrl(url: string) {
    try {
      await navigator.clipboard.writeText(url)
    } catch {}
  }

  void load()

  return {
    assets,
    authState,
    loading,
    errorMessage,
    selectedIds,
    keyword,
    typeFilter,
    sortKey,
    sortDirection,
    page,
    totalCount,
    totalPages,
    pagedAssets,
    hasSelection,
    detailOpen,
    detailLoading,
    activeDetail,
    confirmOpen,
    saving,
    actionScope,
    load,
    updateSort,
    goToPage,
    toggleSelectAll,
    toggleSelection,
    openDetail,
    requestDelete,
    confirmDelete,
    sortMeta,
    formatDate,
    formatDateTime,
    copyUrl,
  }
}
