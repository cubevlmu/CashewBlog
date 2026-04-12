import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { loadHomeFeedPage, loadHomePage } from '@/controllers/publicController'

export function useHomePage() {
  const route = useRoute()
  const router = useRouter()
  const pageSize = 20
  type HomePageData = Awaited<ReturnType<typeof loadHomePage>>

  const homeConfig = ref<HomePageData['config'] | null>(null)
  const pinnedPosts = ref<HomePageData['pinnedPosts']>([])
  const posts = ref<HomePageData['posts']>([])
  const tags = ref<HomePageData['tags']>([])
  const categories = ref<HomePageData['categories']>([])
  const searchKeyword = ref('')
  const loading = ref(true)
  const feedLoading = ref(false)
  const feedError = ref('')
  const hasMore = ref(true)
  const page = ref(1)
  const imageFallback = ref(false)
  const searchOpen = ref(false)
  const dialogType = ref<'tags' | 'categories' | null>(null)
  const sentinel = ref<HTMLElement | null>(null)
  const contentTop = ref<HTMLElement | null>(null)
  const viewportWidth = ref(typeof window === 'undefined' ? 1440 : window.innerWidth)
  const shouldRestoreScrollPosition = ref(false)
  const restoreScrollStorageKey = 'cashew:restore-home-scroll-y'
  const heroTitleDisplay = ref('')

  let observer: IntersectionObserver | null = null
  let titleTimer: number | null = null

  const activeDialogItems = computed(() => (dialogType.value === 'tags' ? tags.value : categories.value))
  const activeDialogTitle = computed(() => (dialogType.value === 'tags' ? '标签' : '分类'))
  const currentArticleId = computed(() => {
    const value = Number(route.params.id ?? 0)
    return Number.isFinite(value) && value > 0 ? value : null
  })
  const isArticleRoute = computed(() => route.name === 'article' && currentArticleId.value !== null)
  const isSearchRoute = computed(() => route.name === 'search')
  const isAboutRoute = computed(() => route.name === 'about')
  const isUserRoute = computed(() => route.name === 'user')
  const isTaxonomyRoute = computed(() =>
    route.name === 'tag' || route.name === 'tags' || route.name === 'category' || route.name === 'categories',
  )
  const isFeedRoute = computed(() =>
    !isArticleRoute.value && !isSearchRoute.value && !isTaxonomyRoute.value && !isAboutRoute.value && !isUserRoute.value,
  )
  const previewPost = computed(() => [...pinnedPosts.value, ...posts.value].find((post) => post.id === currentArticleId.value) ?? null)
  const heroImageUrl = computed(() => {
    if (!homeConfig.value) {
      return ''
    }

    if (homeConfig.value.header.image.trim() === '--bing--') {
      return viewportWidth.value <= 640 ? 'https://bing.img.run/m.php' : 'https://bing.img.run/1920x1080.php'
    }

    return viewportWidth.value <= 640 ? 'https://bing.img.run/m.php' : homeConfig.value.header.image
  })
  const heroStyle = computed(() =>
    heroImageUrl.value && !imageFallback.value
      ? {
          backgroundImage: `linear-gradient(135deg, rgba(33, 22, 14, 0.72), rgba(33, 22, 14, 0.38)), url(${heroImageUrl.value})`,
        }
      : undefined,
  )

  function clearHeroTitleTimer() {
    if (titleTimer !== null) {
      window.clearInterval(titleTimer)
      titleTimer = null
    }
  }

  function startHeroTyping() {
    clearHeroTitleTimer()

    const title = homeConfig.value?.header.title ?? ''
    const animationEnabled = Boolean(homeConfig.value?.header.animation)

    if (!animationEnabled || !title) {
      heroTitleDisplay.value = title
      return
    }

    heroTitleDisplay.value = ''
    let index = 0

    titleTimer = window.setInterval(() => {
      index += 1
      heroTitleDisplay.value = title.slice(0, index)

      if (index >= title.length) {
        clearHeroTitleTimer()
      }
    }, 80)
  }

  function handleResize() {
    viewportWidth.value = window.innerWidth
  }

  function scrollWindowInstant(top: number) {
    const root = document.documentElement
    const previousBehavior = root.style.scrollBehavior
    root.style.scrollBehavior = 'auto'
    window.scrollTo(0, Math.max(top, 0))
    window.setTimeout(() => {
      root.style.scrollBehavior = previousBehavior
    }, 0)
  }

  async function loadHome() {
    loading.value = true
    feedError.value = ''

    try {
      const vm = await loadHomePage(pageSize)

      homeConfig.value = vm.config
      tags.value = vm.tags
      categories.value = vm.categories
      pinnedPosts.value = vm.pinnedPosts
      posts.value = vm.posts
      page.value = vm.page
      hasMore.value = vm.hasMore
      startHeroTyping()
    } catch (error) {
      feedError.value = error instanceof Error ? error.message : '首页加载失败'
    } finally {
      loading.value = false
    }
  }

  async function loadMore() {
    if (feedLoading.value || !hasMore.value || !isFeedRoute.value) {
      return
    }

    feedLoading.value = true
    feedError.value = ''

    try {
      const nextPage = page.value + 1
      const vm = await loadHomeFeedPage(nextPage, pageSize, {
        config: homeConfig.value ?? undefined,
        tags: tags.value,
        categories: categories.value,
      })

      posts.value = [...posts.value, ...vm.posts]
      page.value = vm.page
      hasMore.value = vm.hasMore
    } catch (error) {
      feedError.value = error instanceof Error ? error.message : '文章流加载失败'
    } finally {
      feedLoading.value = false
    }
  }

  function openSearch(initialKeyword = '') {
    searchKeyword.value = initialKeyword
    searchOpen.value = true
  }

  function submitSearch(keyword: string) {
    searchOpen.value = false
    void router.push({ name: 'search', query: { q: keyword } })
  }

  function handleArticleSelect() {
    sessionStorage.setItem(restoreScrollStorageKey, String(window.scrollY))
  }

  function handleBackToFeed() {
    shouldRestoreScrollPosition.value = true
    void router.push({ name: 'home' })
  }

  function setupObserver() {
    if (!sentinel.value || !isFeedRoute.value) {
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

  function restoreArticleFeedScroll(scrollY: number, retries = 10) {
    if (document.readyState !== 'complete' && retries > 0) {
      window.setTimeout(() => restoreArticleFeedScroll(scrollY, retries - 1), 80)
      return
    }

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        scrollWindowInstant(scrollY)

        if (Math.abs(window.scrollY - scrollY) > 4 && retries > 0) {
          window.setTimeout(() => restoreArticleFeedScroll(scrollY, retries - 1), 80)
          return
        }

        shouldRestoreScrollPosition.value = false
        sessionStorage.removeItem(restoreScrollStorageKey)
      })
    })
  }

  watch([sentinel, isFeedRoute], () => {
    observer?.disconnect()
    observer = null
    setupObserver()
  })

  watch([isArticleRoute, isSearchRoute, isTaxonomyRoute, isAboutRoute, isUserRoute], async ([article, search, taxonomy, about, user]) => {
    if (!article && !search && !taxonomy && !about && !user) {
      return
    }

    await nextTick()
    window.setTimeout(() => {
      const top = contentTop.value?.getBoundingClientRect().top ?? 0
      scrollWindowInstant(window.scrollY + top)
    }, 30)
  })

  watch(
    () => [homeConfig.value?.header.title, homeConfig.value?.header.animation] as const,
    () => {
      startHeroTyping()
    },
  )

  watch(
    () => route.name,
    async (name, previousName) => {
      if (name !== 'home' || previousName !== 'article') {
        return
      }

      const pendingScroll = sessionStorage.getItem(restoreScrollStorageKey)
      if (!pendingScroll || !shouldRestoreScrollPosition.value) {
        return
      }

      await nextTick()
      restoreArticleFeedScroll(Number(pendingScroll))
    },
  )

  onMounted(() => {
    void loadHome()
    window.addEventListener('resize', handleResize)
    setupObserver()

    const pendingScroll = sessionStorage.getItem(restoreScrollStorageKey)
    if (route.name === 'home' && pendingScroll) {
      shouldRestoreScrollPosition.value = true
      window.setTimeout(() => restoreArticleFeedScroll(Number(pendingScroll)), 80)
    }
  })

  onBeforeUnmount(() => {
    window.removeEventListener('resize', handleResize)
    observer?.disconnect()
    clearHeroTitleTimer()
  })

  return {
    homeConfig,
    pinnedPosts,
    posts,
    searchKeyword,
    loading,
    feedLoading,
    feedError,
    hasMore,
    imageFallback,
    searchOpen,
    dialogType,
    sentinel,
    contentTop,
    activeDialogItems,
    activeDialogTitle,
    currentArticleId,
    isArticleRoute,
    isSearchRoute,
    isAboutRoute,
    isUserRoute,
    isTaxonomyRoute,
    previewPost,
    heroTitleDisplay,
    heroImageUrl,
    heroStyle,
    loadHome,
    loadMore,
    openSearch,
    submitSearch,
    handleArticleSelect,
    handleBackToFeed,
  }
}
