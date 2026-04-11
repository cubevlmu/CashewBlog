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

  async function save(state: 'public' | 'private') {
    saving.value = true
    errorMessage.value = ''
    successMessage.value = ''

    try {
      const nextState = canEditState.value ? state : 'draft'
      form.title = form.title.trim()
      form.slug = form.slug.trim() || slugify(form.title)
      form.summary = form.summary.trim()
      form.coverImage = form.coverImage.trim()
      form.state = nextState

      const data = form.id ? await updateMyBlog(form.id, form) : await createMyBlog(form)
      Object.assign(form, data.blog ? await loadEditableBlog(data.blog.id) : createEmptyEditorForm())
      successMessage.value = nextState === 'public' ? '文章已发布' : canEditState.value ? '草稿已保存' : '文章已提交审核'

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
    return save('private')
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
    load,
    addSelectedTag,
    removeTag,
    saveDraft,
    publish,
  }
}
