import { computed, reactive, ref } from 'vue'

import {
  createAdminCategory,
  deleteAdminCategories,
  getAdminCategories,
  updateAdminCategory,
} from '@/controllers/adminController'
import type { AdminCategoryRecord } from '@/types/admin'

function createEmptyForm() {
  return {
    name: '',
    slug: '',
    desc: '',
    parentId: '',
  }
}

export function useAdminCategoriesPage() {
  const categories = ref<AdminCategoryRecord[]>([])
  const loading = ref(false)
  const errorMessage = ref('')
  const selectedIds = ref<number[]>([])
  const sortKey = ref<'name' | 'slug' | 'postCount'>('name')
  const sortDirection = ref<'asc' | 'desc'>('asc')
  const createForm = reactive(createEmptyForm())
  const editForm = reactive(createEmptyForm())
  const editCategory = ref<AdminCategoryRecord | null>(null)
  const editOpen = ref(false)
  const confirmOpen = ref(false)
  const saving = ref(false)
  const page = ref(1)
  const pageSize = 5
  const batchAction = ref('')

  const sortedCategories = computed(() => {
    const list = [...categories.value]
    list.sort((left, right) => {
      if (sortKey.value === 'name' && left.level !== right.level) {
        return left.level - right.level
      }

      const factor = sortDirection.value === 'asc' ? 1 : -1
      if (sortKey.value === 'postCount') {
        return (left.postCount - right.postCount) * factor
      }

      return left[sortKey.value].localeCompare(right[sortKey.value], 'zh-CN') * factor
    })
    return list
  })

  const pagedCategories = computed(() => {
    const start = (page.value - 1) * pageSize
    return sortedCategories.value.slice(start, start + pageSize)
  })
  const parentOptions = computed(() => categories.value.filter((category) => !editCategory.value || category.id !== editCategory.value.id))
  const hasSelection = computed(() => selectedIds.value.length > 0)
  const totalCount = computed(() => categories.value.length)
  const totalPages = computed(() => Math.max(1, Math.ceil(sortedCategories.value.length / pageSize)))

  async function load() {
    loading.value = true
    errorMessage.value = ''

    try {
      categories.value = await getAdminCategories()
      selectedIds.value = selectedIds.value.filter((id) => categories.value.some((category) => category.id === id && !category.isDefault))
      page.value = Math.min(page.value, Math.max(1, Math.ceil(categories.value.length / pageSize)))
    } catch (error) {
      errorMessage.value = error instanceof Error ? error.message : '分类列表加载失败'
    } finally {
      loading.value = false
    }
  }

  function toggleSelectAll() {
    const selectableIds = pagedCategories.value.filter((category) => !category.isDefault).map((category) => category.id)
    selectedIds.value = selectedIds.value.length === selectableIds.length ? [] : selectableIds
  }

  function toggleSelection(id: number) {
    const target = categories.value.find((category) => category.id === id)
    if (target?.isDefault) {
      return
    }

    selectedIds.value = selectedIds.value.includes(id)
      ? selectedIds.value.filter((value) => value !== id)
      : [...selectedIds.value, id]
  }

  function updateSort(nextKey: 'name' | 'slug' | 'postCount') {
    if (sortKey.value === nextKey) {
      sortDirection.value = sortDirection.value === 'asc' ? 'desc' : 'asc'
      return
    }

    sortKey.value = nextKey
    sortDirection.value = 'asc'
    page.value = 1
  }

  function goToPage(nextPage: number) {
    page.value = Math.min(totalPages.value, Math.max(1, nextPage))
    selectedIds.value = []
  }

  function applyBatchAction() {
    if (batchAction.value !== 'delete' || !selectedIds.value.length) {
      return
    }

    requestDelete([...selectedIds.value])
  }

  async function submitCreate() {
    if (!createForm.name.trim()) {
      return
    }

    saving.value = true
    try {
      await createAdminCategory({
        name: createForm.name.trim(),
        slug: (createForm.slug.trim() || createForm.name.trim()).toLowerCase(),
        desc: createForm.desc.trim(),
        parentId: createForm.parentId ? Number(createForm.parentId) : null,
      })
      Object.assign(createForm, createEmptyForm())
      await load()
    } finally {
      saving.value = false
    }
  }

  function openEdit(category: AdminCategoryRecord) {
    editCategory.value = category
    editForm.name = category.name
    editForm.slug = category.slug
    editForm.desc = category.desc
    editForm.parentId = category.parentId ? String(category.parentId) : ''
    editOpen.value = true
  }

  async function submitEdit() {
    if (!editCategory.value || !editForm.name.trim()) {
      return
    }

    saving.value = true
    try {
      await updateAdminCategory(editCategory.value.id, {
        name: editForm.name.trim(),
        slug: (editForm.slug.trim() || editForm.name.trim()).toLowerCase(),
        desc: editForm.desc.trim(),
        parentId: editForm.parentId ? Number(editForm.parentId) : null,
      })
      editOpen.value = false
      editCategory.value = null
      await load()
    } finally {
      saving.value = false
    }
  }

  function requestDelete(ids: number[]) {
    const deletableIds = ids.filter((id) => !categories.value.find((category) => category.id === id)?.isDefault)
    if (!deletableIds.length) {
      return
    }

    selectedIds.value = deletableIds
    confirmOpen.value = true
  }

  async function confirmDelete() {
    if (!selectedIds.value.length) {
      return
    }

    saving.value = true
    try {
      await deleteAdminCategories(selectedIds.value)
      confirmOpen.value = false
      editOpen.value = false
      editCategory.value = null
      selectedIds.value = []
      batchAction.value = ''
      await load()
    } finally {
      saving.value = false
    }
  }

  function indentLabel(category: AdminCategoryRecord) {
    return `${category.level > 0 ? '— '.repeat(category.level) : ''}${category.name}`
  }

  void load()

  return {
    categories,
    sortedCategories,
    pagedCategories,
    loading,
    errorMessage,
    selectedIds,
    sortKey,
    sortDirection,
    createForm,
    editForm,
    editCategory,
    editOpen,
    confirmOpen,
    saving,
    batchAction,
    parentOptions,
    hasSelection,
    totalCount,
    page,
    totalPages,
    load,
    toggleSelectAll,
    toggleSelection,
    updateSort,
    submitCreate,
    openEdit,
    submitEdit,
    requestDelete,
    confirmDelete,
    applyBatchAction,
    indentLabel,
    goToPage,
  }
}
