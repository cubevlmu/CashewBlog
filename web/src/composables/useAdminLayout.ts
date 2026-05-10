import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { logout } from '@/services/auth'
import { authState } from '@/stores/authStore'

type AdminNavItem = {
  label: string
  name: string
  requiresAdmin?: boolean
}

type AdminNavGroup = {
  title: string
  items: AdminNavItem[]
}

const groups: AdminNavGroup[] = [
  {
    title: '概览',
    items: [{ label: '仪表盘', name: 'admin-dashboard' }],
  },
  {
    title: '内容',
    items: [
      { label: '文章管理', name: 'admin-posts' },
      { label: '分类管理', name: 'admin-categories', requiresAdmin: true },
      { label: '标签管理', name: 'admin-tags', requiresAdmin: true },
      { label: '评论管理', name: 'admin-comments' },
    ],
  },
  {
    title: '资源',
    items: [{ label: '资源库', name: 'admin-assets' }],
  },
  {
    title: '站点',
    items: [
      { label: '站点设置', name: 'admin-settings', requiresAdmin: true },
      { label: '首页配置', name: 'admin-home-config', requiresAdmin: true },
    ],
  },
  {
    title: '用户',
    items: [
      { label: '用户管理', name: 'admin-users', requiresAdmin: true },
      { label: '个人中心', name: 'admin-profile' },
    ],
  },
]

export function useAdminLayout() {
  const route = useRoute()
  const router = useRouter()
  const navDrawerOpen = ref(false)
  const actionDrawerOpen = ref(false)

  const pageTitle = computed(() => String(route.meta.adminTitle ?? '后台'))
  const useCompactNav = computed(() => route.name === 'admin-post-editor')
  const visibleGroups = computed(() =>
    groups
      .map((group) => ({
        ...group,
        items: group.items.filter((item) => !item.requiresAdmin || authState.isAdmin),
      }))
      .filter((group) => group.items.length > 0),
  )

  function isActive(name: string) {
    return route.name === name
  }

  async function goTo(name: string) {
    navDrawerOpen.value = false
    await router.push({ name })
  }

  function toggleNavDrawer() {
    navDrawerOpen.value = !navDrawerOpen.value
  }

  function toggleActionDrawer() {
    actionDrawerOpen.value = !actionDrawerOpen.value
  }

  function closeDrawers() {
    navDrawerOpen.value = false
    actionDrawerOpen.value = false
  }

  async function goToHome() {
    closeDrawers()
    await router.push({ name: 'home' })
  }

  async function handleLogout() {
    logout()
    closeDrawers()
    await router.replace({ name: 'login' })
  }

  return {
    authState,
    groups: visibleGroups,
    pageTitle,
    useCompactNav,
    navDrawerOpen,
    actionDrawerOpen,
    isActive,
    goTo,
    goToHome,
    toggleNavDrawer,
    toggleActionDrawer,
    closeDrawers,
    handleLogout,
  }
}
