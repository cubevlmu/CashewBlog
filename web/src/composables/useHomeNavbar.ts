import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'

import { authState } from '@/stores/authStore'

export function useHomeNavbar() {
  const router = useRouter()
  const infoMenuOpen = ref(false)
  const menuOpen = ref(false)
  const mobileSearchKeyword = ref('')

  const navClass = computed(() => ({
    'home-navbar__nav': true,
    'is-open': menuOpen.value,
  }))
  const isLoggedIn = computed(() => authState.isLoggedIn)
  const userAvatar = computed(() => authState.user?.avatar || '/placeholder-avatar.svg')

  function closeMenu() {
    infoMenuOpen.value = false
    menuOpen.value = false
  }

  function toggleInfoMenu() {
    infoMenuOpen.value = !infoMenuOpen.value
    menuOpen.value = false
  }

  function toggleMenu() {
    menuOpen.value = !menuOpen.value
    infoMenuOpen.value = false
  }

  function submitMobileSearch() {
    const keyword = mobileSearchKeyword.value.trim()
    if (!keyword) {
      return
    }

    closeMenu()
    void router.push({ name: 'search', query: { q: keyword } })
  }

  function handleNavClick(link: string) {
    closeMenu()

    if (link === '#categories') {
      void router.push({ name: 'categories' })
      return
    }

    if (link === '#tags') {
      void router.push({ name: 'tags' })
      return
    }

    if (link.startsWith('/')) {
      void router.push(link)
      return
    }

    if (link.startsWith('#')) {
      const element = document.querySelector(link)
      element?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      return
    }

    window.location.href = link
  }

  function openUserPage() {
    closeMenu()
    void router.push(authState.isLoggedIn ? { name: 'user' } : { name: 'login', query: { redirect: '/user' } })
  }

  return {
    infoMenuOpen,
    menuOpen,
    mobileSearchKeyword,
    navClass,
    isLoggedIn,
    userAvatar,
    closeMenu,
    toggleInfoMenu,
    toggleMenu,
    submitMobileSearch,
    handleNavClick,
    openUserPage,
  }
}
