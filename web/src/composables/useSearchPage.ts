import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { loadSearchResults } from '@/controllers/publicController'

export function useSearchPage() {
  const route = useRoute()
  const router = useRouter()
  type SearchResultData = Awaited<ReturnType<typeof loadSearchResults>>

  const results = ref<SearchResultData['list']>([])
  const loading = ref(false)
  const errorMessage = ref('')
  const total = ref(0)
  const page = ref(1)
  const pageSize = 10
  const overlayOpen = ref(false)
  const sentinel = ref<HTMLElement | null>(null)

  let observer: IntersectionObserver | null = null

  const keyword = computed(() => String(route.query.q ?? '').trim())
  const canLoadMore = computed(() => results.value.length < total.value)

  async function load(reset = true) {
    if (!keyword.value) {
      results.value = []
      total.value = 0
      errorMessage.value = ''
      return
    }

    loading.value = true
    errorMessage.value = ''

    try {
      const currentPage = reset ? 1 : page.value + 1
      const vm = await loadSearchResults(keyword.value, currentPage, pageSize)
      page.value = currentPage
      total.value = vm.total
      results.value = reset ? vm.list : [...results.value, ...vm.list]
    } catch (error) {
      errorMessage.value = error instanceof Error ? error.message : '搜索失败'
    } finally {
      loading.value = false
    }
  }

  async function loadMore() {
    if (loading.value || !canLoadMore.value) {
      return
    }

    await load(false)
  }

  function setupObserver() {
    if (!sentinel.value || !keyword.value) {
      return
    }

    observer = new IntersectionObserver((entries) => {
      const [entry] = entries
      if (entry?.isIntersecting) {
        void loadMore()
      }
    }, { rootMargin: '240px 0px' })

    observer.observe(sentinel.value)
  }

  function submitSearch(nextKeyword: string) {
    overlayOpen.value = false
    void router.push({ name: 'search', query: { q: nextKeyword } })
  }

  watch(keyword, () => {
    void load(true)
  })

  watch([sentinel, keyword, canLoadMore], () => {
    observer?.disconnect()
    observer = null
    if (canLoadMore.value) {
      setupObserver()
    }
  })

  onMounted(() => {
    void load(true)
  })

  onBeforeUnmount(() => {
    observer?.disconnect()
  })

  return {
    results,
    loading,
    errorMessage,
    total,
    overlayOpen,
    sentinel,
    keyword,
    canLoadMore,
    load,
    submitSearch,
  }
}
