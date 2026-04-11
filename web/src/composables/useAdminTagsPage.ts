import { computed, reactive, ref } from 'vue'

import { createAdminTag, deleteAdminTags, getAdminTags, updateAdminTag } from '@/controllers/adminController'
import type { AdminTagRecord } from '@/types/admin'

function createEmptyForm() {
  return {
    name: '',
    slug: '',
    desc: '',
  }
}

export function useAdminTagsPage() {
  const tags = ref<AdminTagRecord[]>([])
  const loading = ref(false)
  const errorMessage = ref('')
  const selectedIds = ref<number[]>([])
  const sortKey = ref<'name' | 'slug' | 'postCount'>('name')
  const sortDirection = ref<'asc' | 'desc'>('asc')
  const createForm = reactive(createEmptyForm())
  const quickEditForm = reactive(createEmptyForm())
  const quickEditTag = ref<AdminTagRecord | null>(null)
  const quickEditOpen = ref(false)
  const confirmOpen = ref(false)
  const saving = ref(false)
  const page = ref(1)
  const pageSize = 5
  const batchAction = ref('')

  const sortedTags = computed(() => {
    const list = [...tags.value]
    list.sort((left, right) => {
      const factor = sortDirection.value === 'asc' ? 1 : -1
      if (sortKey.value === 'postCount') {
        return (left.postCount - right.postCount) * factor
      }
      return left[sortKey.value].localeCompare(right[sortKey.value], 'zh-CN') * factor
    })
    return list
  })

  const pagedTags = computed(() => {
    const start = (page.value - 1) * pageSize
    return sortedTags.value.slice(start, start + pageSize)
  })
  const hasSelection = computed(() => selectedIds.value.length > 0)
  const totalCount = computed(() => tags.value.length)
  const totalPages = computed(() => Math.max(1, Math.ceil(sortedTags.value.length / pageSize)))

  async function load() {
    loading.value = true
    errorMessage.value = ''

    try {
      tags.value = await getAdminTags()
      selectedIds.value = selectedIds.value.filter((id) => tags.value.some((tag) => tag.id === id))
      page.value = Math.min(page.value, Math.max(1, Math.ceil(tags.value.length / pageSize)))
    } catch (error) {
      errorMessage.value = error instanceof Error ? error.message : '标签列表加载失败'
    } finally {
      loading.value = false
    }
  }

  function toggleSelectAll() {
    selectedIds.value = selectedIds.value.length === pagedTags.value.length ? [] : pagedTags.value.map((tag) => tag.id)
  }

  function toggleSelection(id: number) {
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
      await createAdminTag({
        name: createForm.name.trim(),
        slug: (createForm.slug.trim() || createForm.name.trim()).toLowerCase(),
        desc: createForm.desc.trim(),
      })
      createForm.name = ''
      createForm.slug = ''
      createForm.desc = ''
      await load()
    } finally {
      saving.value = false
    }
  }

  function openQuickEdit(tag: AdminTagRecord) {
    quickEditTag.value = tag
    quickEditForm.name = tag.name
    quickEditForm.slug = tag.slug
    quickEditForm.desc = tag.desc
    quickEditOpen.value = true
  }

  async function submitQuickEdit() {
    if (!quickEditTag.value || !quickEditForm.name.trim()) {
      return
    }

    saving.value = true
    try {
      await updateAdminTag(quickEditTag.value.id, {
        name: quickEditForm.name.trim(),
        slug: (quickEditForm.slug.trim() || quickEditForm.name.trim()).toLowerCase(),
        desc: quickEditForm.desc.trim(),
      })
      quickEditOpen.value = false
      quickEditTag.value = null
      await load()
    } finally {
      saving.value = false
    }
  }

  function requestDelete(ids: number[]) {
    if (!ids.length) {
      return
    }

    selectedIds.value = ids
    confirmOpen.value = true
  }

  async function confirmDelete() {
    if (!selectedIds.value.length) {
      return
    }

    saving.value = true
    try {
      await deleteAdminTags(selectedIds.value)
      confirmOpen.value = false
      quickEditOpen.value = false
      quickEditTag.value = null
      selectedIds.value = []
      batchAction.value = ''
      await load()
    } finally {
      saving.value = false
    }
  }

  void load()

  return {
    tags,
    sortedTags,
    pagedTags,
    loading,
    errorMessage,
    selectedIds,
    sortKey,
    sortDirection,
    createForm,
    quickEditForm,
    quickEditOpen,
    confirmOpen,
    saving,
    batchAction,
    hasSelection,
    totalCount,
    page,
    totalPages,
    load,
    toggleSelectAll,
    toggleSelection,
    updateSort,
    submitCreate,
    openQuickEdit,
    submitQuickEdit,
    requestDelete,
    confirmDelete,
    applyBatchAction,
    goToPage,
  }
}
