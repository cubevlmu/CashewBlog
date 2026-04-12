import { computed, ref } from 'vue'

import {
  createAdminUser,
  deleteAdminUsers,
  getAdminUserById,
  getAdminUsers,
  updateAdminUser,
} from '@/controllers/adminController'
import { authState } from '@/stores/authStore'
import type { AdminUserRecord } from '@/types/admin'

type UserSortKey = 'username' | 'email' | 'lastLoginAt'

export function useAdminUsersPage() {
  const users = ref<AdminUserRecord[]>([])
  const loading = ref(false)
  const errorMessage = ref('')
  const selectedIds = ref<number[]>([])
  const sortKey = ref<UserSortKey>('username')
  const sortDirection = ref<'asc' | 'desc'>('asc')
  const page = ref(1)
  const pageSize = 8
  const detailOpen = ref(false)
  const detailLoading = ref(false)
  const activeDetail = ref<AdminUserRecord | null>(null)
  const editOpen = ref(false)
  const createOpen = ref(false)
  const saving = ref(false)
  const editForm = ref({
    id: 0,
    username: '',
    displayName: '',
    email: '',
    avatar: '',
    avatarId: null as number | null,
    gender: 'unknown' as AdminUserRecord['gender'],
    bio: '',
    website: '',
    role: 'user' as AdminUserRecord['role'],
  })
  const editError = ref('')
  const editSuccess = ref('')
  const confirmDeleteOpen = ref(false)

  const sortedUsers = computed(() => [...users.value].sort((left, right) => {
    if (sortKey.value === 'lastLoginAt') {
      return sortDirection.value === 'asc'
        ? new Date(left.lastLoginAt).getTime() - new Date(right.lastLoginAt).getTime()
        : new Date(right.lastLoginAt).getTime() - new Date(left.lastLoginAt).getTime()
    }
    const result = left[sortKey.value].localeCompare(right[sortKey.value], 'zh-CN')
    return sortDirection.value === 'asc' ? result : -result
  }))
  const totalCount = computed(() => sortedUsers.value.length)
  const totalPages = computed(() => Math.max(1, Math.ceil(totalCount.value / pageSize)))
  const editingUser = computed(() => users.value.find((user) => user.id === editForm.value.id) ?? null)
  const pagedUsers = computed(() => {
    const start = (page.value - 1) * pageSize
    return sortedUsers.value.slice(start, start + pageSize)
  })

  async function load() {
    loading.value = true
    errorMessage.value = ''
    try {
      users.value = await getAdminUsers()
      selectedIds.value = selectedIds.value.filter((id) => users.value.some((user) => user.id === id))
      page.value = Math.min(page.value, totalPages.value)
    } catch (error) {
      errorMessage.value = error instanceof Error ? error.message : '用户列表加载失败'
    } finally {
      loading.value = false
    }
  }

  function updateSort(nextKey: UserSortKey) {
    if (sortKey.value === nextKey) {
      sortDirection.value = sortDirection.value === 'asc' ? 'desc' : 'asc'
    } else {
      sortKey.value = nextKey
      sortDirection.value = nextKey === 'lastLoginAt' ? 'desc' : 'asc'
    }
  }

  function toggleSelectAll() {
    selectedIds.value = selectedIds.value.length === pagedUsers.value.length ? [] : pagedUsers.value.map((user) => user.id)
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
      activeDetail.value = await getAdminUserById(id)
    } finally {
      detailLoading.value = false
    }
  }

  function openEdit(user: AdminUserRecord) {
    createOpen.value = false
    editForm.value = {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      email: user.email,
      avatar: user.avatar,
      avatarId: user.avatarId,
      gender: user.gender,
      bio: user.bio,
      website: user.website,
      role: user.role,
    }
    editError.value = ''
    editSuccess.value = ''
    editOpen.value = true
  }

  function openCreate() {
    if (!authState.isAdmin) return
    editOpen.value = false
    editForm.value = {
      id: 0,
      username: '',
      displayName: '',
      email: '',
      avatar: '',
      avatarId: null,
      gender: 'unknown',
      bio: '',
      website: '',
      role: 'user',
    }
    editError.value = ''
    editSuccess.value = ''
    createOpen.value = true
  }

  async function submitEdit() {
    editError.value = ''
    editSuccess.value = ''
    if (!editOpen.value && createOpen.value && !editForm.value.username.trim()) {
      editError.value = '用户名不能为空'
      return
    }
    if (!editForm.value.displayName.trim()) {
      editError.value = '显示名称不能为空'
      return
    }
    if (!editForm.value.email.trim()) {
      editError.value = '邮箱不能为空'
      return
    }

    saving.value = true
    try {
      if (createOpen.value) {
        await createAdminUser({
          username: editForm.value.username.trim(),
          displayName: editForm.value.displayName.trim(),
          email: editForm.value.email.trim(),
          avatarId: editForm.value.avatarId,
          gender: editForm.value.gender,
          bio: editForm.value.bio.trim(),
          website: editForm.value.website.trim(),
          role: editForm.value.role,
        })
        editSuccess.value = '用户已创建'
        createOpen.value = false
      } else {
        await updateAdminUser(editForm.value.id, {
          displayName: editForm.value.displayName.trim(),
          email: editForm.value.email.trim(),
          avatarId: editForm.value.avatarId,
          gender: editForm.value.gender,
          bio: editForm.value.bio.trim(),
          website: editForm.value.website.trim(),
          role: editForm.value.role,
        })
        editSuccess.value = '用户资料已更新'
        editOpen.value = false
      }
      await load()
      if (activeDetail.value?.id === editForm.value.id) {
        activeDetail.value = await getAdminUserById(editForm.value.id)
      }
    } catch (error) {
      editError.value = error instanceof Error ? error.message : '用户保存失败'
    } finally {
      saving.value = false
    }
  }

  function requestDelete(ids: number[]) {
    if (!authState.isAdmin || !ids.length) return
    selectedIds.value = [...ids]
    confirmDeleteOpen.value = true
  }

  async function confirmDelete() {
    if (!authState.isAdmin || !selectedIds.value.length) return
    saving.value = true
    try {
      await deleteAdminUsers(selectedIds.value)
      confirmDeleteOpen.value = false
      detailOpen.value = false
      activeDetail.value = null
      selectedIds.value = []
      await load()
    } catch (error) {
      errorMessage.value = error instanceof Error ? error.message : '删除用户失败'
    } finally {
      saving.value = false
    }
  }

  function goToPage(nextPage: number) {
    page.value = Math.min(totalPages.value, Math.max(1, nextPage))
    selectedIds.value = []
  }

  function roleLabel(role: AdminUserRecord['role']) {
    if (role === 'admin') return '管理员'
    if (role === 'editor') return '编辑'
    return '普通用户'
  }

  function formatLastLogin(value: string) {
    return new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
  }

  function articleSummary(user: AdminUserRecord) {
    return `共 ${user.postCount} 篇文章`
  }

  void load()

  return {
    authState,
    users,
    loading,
    errorMessage,
    selectedIds,
    sortKey,
    sortDirection,
    page,
    totalCount,
    totalPages,
    editingUser,
    pagedUsers,
    detailOpen,
    detailLoading,
    activeDetail,
    editOpen,
    createOpen,
    saving,
    editForm,
    editError,
    editSuccess,
    confirmDeleteOpen,
    load,
    updateSort,
    toggleSelectAll,
    toggleSelection,
    openDetail,
    openEdit,
    openCreate,
    submitEdit,
    requestDelete,
    confirmDelete,
    goToPage,
    roleLabel,
    formatLastLogin,
    articleSummary,
  }
}
