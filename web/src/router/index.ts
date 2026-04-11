import { createRouter, createWebHistory } from 'vue-router'

const HomePage = () => import('@/pages/HomePage.vue')
const AdminPage = () => import('@/pages/AdminPage.vue')
const AdminDashboardPage = () => import('@/pages/admin/AdminDashboardPage.vue')
const AdminPostsPage = () => import('@/pages/admin/AdminPostsPage.vue')
const AdminPostEditorPage = () => import('@/pages/admin/AdminPostEditorPage.vue')
const AdminCategoriesPage = () => import('@/pages/admin/AdminCategoriesPage.vue')
const AdminTagsPage = () => import('@/pages/admin/AdminTagsPage.vue')
const AdminCommentsPage = () => import('@/pages/admin/AdminCommentsPage.vue')
const AdminAssetsPage = () => import('@/pages/admin/AdminAssetsPage.vue')
const AdminSettingsPage = () => import('@/pages/admin/AdminSettingsPage.vue')
const AdminHomeConfigPage = () => import('@/pages/admin/AdminHomeConfigPage.vue')
const AdminUsersPage = () => import('@/pages/admin/AdminUsersPage.vue')
const AdminProfilePage = () => import('@/pages/admin/AdminProfilePage.vue')
const LoginPage = () => import('@/pages/LoginPage.vue')
const NotFoundPage = () => import('@/pages/NotFoundPage.vue')
import { authState } from '@/stores/authStore'

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'home',
      component: HomePage,
    },
    {
      path: '/article/:id',
      name: 'article',
      component: HomePage,
      props: true,
    },
    {
      path: '/search',
      name: 'search',
      component: HomePage,
    },
    {
      path: '/about',
      name: 'about',
      component: HomePage,
    },
    {
      path: '/admin',
      component: AdminPage,
      meta: { standalone: true, hideFooter: true, requiresAuth: true },
      redirect: { name: 'admin-dashboard' },
      children: [
        {
          path: 'dashboard',
          name: 'admin-dashboard',
          component: AdminDashboardPage,
          meta: { adminTitle: '仪表盘' },
        },
        {
          path: 'posts',
          name: 'admin-posts',
          component: AdminPostsPage,
          meta: { adminTitle: '文章管理' },
        },
        {
          path: 'posts/editor/:id?',
          name: 'admin-post-editor',
          component: AdminPostEditorPage,
          meta: { adminTitle: '写文章' },
        },
        {
          path: 'categories',
          name: 'admin-categories',
          component: AdminCategoriesPage,
          meta: { adminTitle: '分类管理', requiresAdmin: true },
        },
        {
          path: 'tags',
          name: 'admin-tags',
          component: AdminTagsPage,
          meta: { adminTitle: '标签管理', requiresAdmin: true },
        },
        {
          path: 'comments',
          name: 'admin-comments',
          component: AdminCommentsPage,
          meta: { adminTitle: '评论管理' },
        },
        {
          path: 'assets',
          name: 'admin-assets',
          component: AdminAssetsPage,
          meta: { adminTitle: '资源库' },
        },
        {
          path: 'settings',
          name: 'admin-settings',
          component: AdminSettingsPage,
          meta: { adminTitle: '站点设置', requiresAdmin: true },
        },
        {
          path: 'home-config',
          name: 'admin-home-config',
          component: AdminHomeConfigPage,
          meta: { adminTitle: '首页配置', requiresAdmin: true },
        },
        {
          path: 'users',
          name: 'admin-users',
          component: AdminUsersPage,
          meta: { adminTitle: '用户管理', requiresAdmin: true },
        },
        {
          path: 'profile',
          name: 'admin-profile',
          component: AdminProfilePage,
          meta: { adminTitle: '个人中心' },
        },
      ],
    },
    {
      path: '/login',
      name: 'login',
      component: LoginPage,
      meta: { standalone: true, hideFooter: true },
    },
    {
      path: '/user',
      name: 'user',
      component: HomePage,
      meta: { requiresAuth: true },
    },
    {
      path: '/tags/:slug',
      name: 'tag',
      component: HomePage,
      meta: { taxonomyType: 'tags' },
    },
    {
      path: '/tags',
      name: 'tags',
      component: HomePage,
      meta: { taxonomyType: 'tags' },
    },
    {
      path: '/categories/:slug',
      name: 'category',
      component: HomePage,
      meta: { taxonomyType: 'categories' },
    },
    {
      path: '/categories',
      name: 'categories',
      component: HomePage,
      meta: { taxonomyType: 'categories' },
    },
    {
      path: '/:pathMatch(.*)*',
      name: 'not-found',
      component: NotFoundPage,
    },
  ],
  scrollBehavior(to, from) {
    const shellRoutes = ['home', 'article', 'search', 'tag', 'tags', 'category', 'categories', 'about', 'user']

    if (shellRoutes.includes(String(to.name)) && shellRoutes.includes(String(from.name))) {
      return false
    }

    if (['article', 'search', 'tag', 'tags', 'category', 'categories', 'about', 'user'].includes(String(to.name))) {
      return false
    }

    return { top: 0 }
  },
})

router.beforeEach((to) => {
  if (to.meta.requiresAuth && !authState.isLoggedIn) {
    return {
      name: 'login',
      query: { redirect: to.fullPath },
    }
  }

  if (to.meta.requiresAdmin && !authState.isAdmin) {
    return authState.isLoggedIn ? { name: 'admin-dashboard' } : {
      name: 'login',
      query: { redirect: to.fullPath },
    }
  }

  return true
})
