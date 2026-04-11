import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'

import { logout } from '@/controllers/authController'
import { loadAuthorPosts } from '@/controllers/publicController'
import { authComputed, authState } from '@/stores/authStore'

export function useUserPage() {
  const router = useRouter()
  const posts = ref<Array<Awaited<ReturnType<typeof loadAuthorPosts>>['list'][number]>>([])
  const loading = ref(false)
  const errorMessage = ref('')
  const total = ref(0)
  const page = ref(1)
  const pageSize = 8

  const currentUser = computed(() => authState.user)
  const canEnterAdmin = computed(() => authState.isLoggedIn)
  const totalPages = computed(() => Math.max(1, Math.ceil(total.value / pageSize)))
  const hasPreviousPage = computed(() => page.value > 1)
  const hasNextPage = computed(() => page.value < totalPages.value)
  const roleLabel = computed(() => {
    if (currentUser.value?.role === 'admin') {
      return '管理员'
    }

    if (currentUser.value?.role === 'editor') {
      return '编辑'
    }

    return '普通用户'
  })
  const genderLabel = computed(() => {
    if (currentUser.value?.gender === 'male') {
      return '男'
    }

    if (currentUser.value?.gender === 'female') {
      return '女'
    }

    return '未设置'
  })
  const debugEnabled = computed(() => import.meta.env.DEV)

  async function load(nextPage = 1) {
    if (!currentUser.value) {
      posts.value = []
      total.value = 0
      errorMessage.value = ''
      return
    }

    loading.value = true
    errorMessage.value = ''

    try {
      const response = await loadAuthorPosts(currentUser.value.username, nextPage, pageSize)
      page.value = nextPage
      total.value = response.total
      posts.value = response.list
    } catch (error) {
      errorMessage.value = error instanceof Error ? error.message : '用户文章加载失败'
    } finally {
      loading.value = false
    }
  }

  async function goToPage(nextPage: number) {
    if (loading.value || nextPage < 1 || nextPage > totalPages.value) {
      return
    }

    await load(nextPage)
  }

  async function goToPreviousPage() {
    if (!hasPreviousPage.value) {
      return
    }

    await goToPage(page.value - 1)
  }

  async function goToNextPage() {
    if (!hasNextPage.value) {
      return
    }

    await goToPage(page.value + 1)
  }

  async function handleLogout() {
    logout()
    await router.replace({ name: 'home' })
  }

  watch(currentUser, () => {
    void load(1)
  }, { immediate: true })

  return {
    authState,
    authComputed,
    currentUser,
    posts,
    loading,
    errorMessage,
    total,
    canEnterAdmin,
    page,
    totalPages,
    hasPreviousPage,
    hasNextPage,
    roleLabel,
    genderLabel,
    debugEnabled,
    load,
    goToPage,
    goToPreviousPage,
    goToNextPage,
    handleLogout,
  }
}
