<script setup lang="ts">
import { reactive } from 'vue'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
import { faBars, faEllipsisVertical } from '@fortawesome/free-solid-svg-icons'

import AppDrawer from '@/components/AppDrawer.vue'
import { useAdminLayout } from '@/composables/useAdminLayout'

const admin = reactive(useAdminLayout())
</script>

<template>
  <section class="admin-page">
    <aside class="admin-sidebar">
      <div class="admin-brand">
        <span class="admin-brand__mark">C</span>
        <div>
          <p class="eyebrow">Admin</p>
          <h1>Cashew 后台</h1>
        </div>
      </div>

      <nav class="admin-nav" aria-label="后台导航">
        <section v-for="group in admin.groups" :key="group.title" class="admin-nav__group">
          <p class="admin-nav__group-title">{{ group.title }}</p>
          <button
            v-for="item in group.items"
            :key="item.name"
            class="admin-nav__item"
            :class="{ 'is-active': admin.isActive(item.name) }"
            type="button"
            @click="admin.goTo(item.name)"
          >
            {{ item.label }}
          </button>
        </section>
      </nav>
    </aside>

    <main class="admin-main">
      <header class="admin-topbar">
        <div class="admin-topbar__start">
          <button class="admin-topbar__icon admin-topbar__icon--menu" type="button" @click="admin.toggleNavDrawer">
            <FontAwesomeIcon :icon="faBars" />
          </button>
          <div class="admin-topbar__brand">
            <span class="admin-topbar__title">博客后台</span>
            <span class="admin-topbar__page">{{ admin.pageTitle }}</span>
          </div>
        </div>
        <button class="admin-topbar__icon" type="button" @click="admin.toggleActionDrawer">
          <FontAwesomeIcon :icon="faEllipsisVertical" />
        </button>
      </header>

      <RouterView />
    </main>
  </section>

  <AppDrawer
    v-model="admin.navDrawerOpen"
    direction="ltr"
    size="320px"
    panel-class="admin-mobile-drawer"
  >
      <div class="mobile-drawer__header">
        <p>后台菜单</p>
        <button class="mobile-drawer__close" type="button" @click="admin.closeDrawers">关闭</button>
      </div>
      <nav class="admin-nav admin-nav--drawer" aria-label="后台导航">
        <section v-for="group in admin.groups" :key="group.title" class="admin-nav__group">
          <p class="admin-nav__group-title">{{ group.title }}</p>
          <button
            v-for="item in group.items"
            :key="item.name"
            class="admin-nav__item"
            :class="{ 'is-active': admin.isActive(item.name) }"
            type="button"
            @click="admin.goTo(item.name)"
          >
            {{ item.label }}
          </button>
        </section>
      </nav>
  </AppDrawer>

  <AppDrawer
    v-model="admin.actionDrawerOpen"
    direction="rtl"
    size="300px"
    panel-class="admin-mobile-drawer"
  >
      <div class="mobile-drawer__header">
        <p>账号菜单</p>
        <button class="mobile-drawer__close" type="button" @click="admin.closeDrawers">关闭</button>
      </div>
      <div class="admin-action-menu">
        <div class="panel admin-action-menu__user">
          <p class="panel__label">当前账号</p>
          <strong>{{ admin.authState.user?.displayName }}</strong>
        </div>
        <button class="mobile-drawer__link" type="button" @click="admin.goToHome">返回前台</button>
        <button class="mobile-drawer__link mobile-drawer__link--danger" type="button" @click="admin.handleLogout">退出登录</button>
      </div>
  </AppDrawer>
</template>
