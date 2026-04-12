import { computed, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { createMyBlog, updateMyBlog } from '@/controllers/adminController'
import { loadEditableBlog, loadEditorSelectOptions } from '@/controllers/publicController'
import {
  createEmptyEditorForm,
  mapEditorFormToAdminEditorRecord,
} from '@/mappers/editor'
import { authState } from '@/stores/authStore'
import type { AdminCategoryRecord, AdminTagRecord } from '@/types/admin'
import type { EditorForm } from '@/types/forms'

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function markdownToSummaryText(value: string) {
  return value
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!\[([^\]]*)]\([^)]+\)/g, '$1')
    .replace(/\[([^\]]+)]\([^)]+\)/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[#>*_`~-]/g, ' ')
    .replace(/\d+\.\s+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function findDefaultCategoryId(categories: AdminCategoryRecord[]) {
  return (
    categories.find((category) => category.isDefault)?.id ??
    categories.find((category) => category.name === '未分类' || category.slug === 'uncategorized')?.id ??
    categories[0]?.id ??
    null
  )
}

export function useAdminPostEditor() {
  const route = useRoute()
  const router = useRouter()
  const form = reactive<EditorForm>(createEmptyEditorForm())
  const loading = ref(false)
  const saving = ref(false)
  const errorMessage = ref('')
  const successMessage = ref('')
  const categories = ref<AdminCategoryRecord[]>([])
  const tags = ref<AdminTagRecord[]>([])
  const selectedTagId = ref<number | null>(null)

  const editorTitle = computed(() => (route.params.id ? '编辑文章' : '新建文章'))
  const availableTagOptions = computed(() => tags.value.filter((tag) => !form.tagIds.includes(tag.id)))
  const canEditState = computed(() => authState.user?.role === 'admin')
  const submitButtonText = computed(() => (canEditState.value ? '发布文章' : '提交审核'))
  const record = computed(() => mapEditorFormToAdminEditorRecord(form, categories.value, tags.value))
  const coverButtonText = computed(() => (form.coverImage ? '更换封面图' : '选择封面图'))

  async function load() {
    loading.value = true
    errorMessage.value = ''

    try {
      const id = route.params.id ? Number(route.params.id) : null
      const [{ categories: nextCategories, tags: nextTags }, detailForm] = await Promise.all([
        loadEditorSelectOptions(),
        Number.isFinite(id) && id ? loadEditableBlog(id) : Promise.resolve(createEmptyEditorForm()),
      ])

      categories.value = nextCategories
      tags.value = nextTags
      Object.assign(form, detailForm)
      form.categoryId = form.categoryId ?? findDefaultCategoryId(nextCategories)
    } catch (error) {
      errorMessage.value = error instanceof Error ? error.message : '编辑器加载失败'
    } finally {
      loading.value = false
    }
  }

  function addSelectedTag() {
    if (!selectedTagId.value || form.tagIds.includes(selectedTagId.value)) {
      return
    }

    form.tagIds = [...form.tagIds, selectedTagId.value]
    selectedTagId.value = null
  }

  function removeTag(tagId: number) {
    form.tagIds = form.tagIds.filter((item) => item !== tagId)
  }

  function openCoverLibrary() {
    successMessage.value = '资源库选择器待接入'
  }

  async function save(state: 'draft' | 'public' | 'private') {
    errorMessage.value = ''
    successMessage.value = ''

    try {
      form.title = form.title.trim()
      if (!form.title) {
        errorMessage.value = '文章标题不能为空'
        return
      }

      saving.value = true
      const nextState = canEditState.value ? state : state === 'public' ? 'private' : 'draft'
      form.slug = form.slug.trim() || slugify(form.title)
      form.summary = form.summary.trim() || markdownToSummaryText(form.contentMarkdown).slice(0, 100)
      form.coverImage = form.coverImage.trim()
      form.categoryId = form.categoryId ?? findDefaultCategoryId(categories.value)
      form.state = nextState

      const data = form.id ? await updateMyBlog(form.id, form) : await createMyBlog(form)
      Object.assign(form, data.blog ? await loadEditableBlog(data.blog.id) : createEmptyEditorForm())
      form.categoryId = form.categoryId ?? findDefaultCategoryId(categories.value)
      successMessage.value = nextState === 'public' ? '文章已发布' : nextState === 'draft' ? '草稿已保存' : '文章已提交审核'

      if (!route.params.id && form.id) {
        await router.replace({ name: 'admin-post-editor', params: { id: String(form.id) } })
      }
    } catch (error) {
      errorMessage.value = error instanceof Error ? error.message : '文章保存失败'
    } finally {
      saving.value = false
    }
  }

  function saveDraft() {
    return save('draft')
  }

  function publish() {
    return save('public')
  }

  watch(
    () => form.title,
    (title) => {
      if (!form.id || !form.slug) {
        form.slug = slugify(title)
      }
    },
  )

  void load()

  return {
    form,
    record,
    loading,
    saving,
    errorMessage,
    successMessage,
    categories,
    tags,
    selectedTagId,
    editorTitle,
    availableTagOptions,
    canEditState,
    submitButtonText,
    coverButtonText,
    load,
    addSelectedTag,
    removeTag,
    openCoverLibrary,
    saveDraft,
    publish,
  }
}
