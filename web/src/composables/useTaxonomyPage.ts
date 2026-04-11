import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'

import { loadTaxonomyDirectory, loadTaxonomyPosts } from '@/controllers/publicController'
import { mapBlogPageToPagedList } from '@/mappers/contentApi'
import { mapApiCategoryToTaxonomyVM, mapApiTagToTaxonomyVM } from '@/mappers/taxonomy'

export function useTaxonomyPage() {
  const route = useRoute()
  const item = ref<ReturnType<typeof mapApiTagToTaxonomyVM> | ReturnType<typeof mapApiCategoryToTaxonomyVM> | null>(null)
  const items = ref<Array<ReturnType<typeof mapApiTagToTaxonomyVM>>>([])
  const posts = ref<ReturnType<typeof mapBlogPageToPagedList>['list']>([])
  const loading = ref(false)
  const errorMessage = ref('')
  const total = ref(0)
  const page = ref(1)
  const pageSize = 10
  const sentinel = ref<HTMLElement | null>(null)

  let observer: IntersectionObserver | null = null

  const kind = computed(() => String(route.meta.taxonomyType ?? 'tags') as 'tags' | 'categories')
  const title = computed(() => (kind.value === 'tags' ? '标签' : '分类'))
  const slug = computed(() => String(route.params.slug ?? '').trim())
  const isListPage = computed(() => slug.value.length === 0)
  const canLoadMore = computed(() => posts.value.length < total.value)

  async function load(reset = true) {
    loading.value = true
    errorMessage.value = ''

    try {
      const mappedItems = await loadTaxonomyDirectory(kind.value)

      items.value = mappedItems
      item.value = isListPage.value ? null : mappedItems.find((entry) => entry.slug === slug.value) ?? null

      if (isListPage.value) {
        page.value = 1
        total.value = 0
        posts.value = []
        return
      }

      const currentPage = reset ? 1 : page.value + 1
      const mapped = await loadTaxonomyPosts(kind.value, slug.value, currentPage, pageSize)
      page.value = mapped.page
      total.value = mapped.total
      posts.value = reset ? mapped.list : [...posts.value, ...mapped.list]
    } catch (error) {
      errorMessage.value = error instanceof Error ? error.message : `${title.value}加载失败`
    } finally {
      loading.value = false
    }
  }

  async function loadMore() {
    if (loading.value || isListPage.value || !canLoadMore.value) {
      return
    }

    await load(false)
  }

  function setupObserver() {
    if (!sentinel.value || isListPage.value || !canLoadMore.value) {
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

  watch(() => route.fullPath, () => {
    void load(true)
  })

  watch([sentinel, slug, canLoadMore], () => {
    observer?.disconnect()
    observer = null
    if (!isListPage.value && canLoadMore.value) {
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
    item,
    items,
    posts,
    loading,
    errorMessage,
    total,
    sentinel,
    kind,
    title,
    slug,
    isListPage,
    canLoadMore,
    load,
  }
}
