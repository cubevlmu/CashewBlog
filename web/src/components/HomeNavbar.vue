<script setup lang="ts">
import { reactive } from 'vue'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
import { faBars, faSearch } from '@fortawesome/free-solid-svg-icons'

import AppDrawer from '@/components/AppDrawer.vue'
import UserAvatar from '@/components/UserAvatar.vue'
import { useHomeNavbar } from '@/composables/useHomeNavbar'
import type { HomeConfig } from '@/types/site'

const props = withDefaults(defineProps<{
  config: HomeConfig['navbar']
  showInfoMenu?: boolean
}>(), {
  showInfoMenu: false,
})

const emit = defineEmits<{
  openSearch: []
}>()

const navbar = reactive(useHomeNavbar())
</script>

<template>
  <header class="home-navbar">
    <div class="container home-navbar__inner">
      <button
        v-if="props.showInfoMenu"
        class="home-navbar__toggle home-navbar__toggle--left"
        type="button"
        @click="navbar.toggleInfoMenu"
      >
        <FontAwesomeIcon :icon="faBars" class="home-navbar__fa-icon" />
        <span class="sr-only">{{ navbar.infoMenuOpen ? '关闭信息面板' : '打开信息面板' }}</span>
      </button>

      <RouterLink class="home-navbar__brand" to="/">
        <span class="home-navbar__brand-mark">C</span>
        <span>{{ config.headText }}</span>
      </RouterLink>

      <button class="home-navbar__toggle home-navbar__toggle--right" type="button" @click="navbar.toggleMenu">
        <FontAwesomeIcon :icon="faSearch" class="home-navbar__fa-icon" />
        <span class="sr-only">{{ navbar.menuOpen ? '关闭菜单面板' : '打开菜单面板' }}</span>
      </button>

      <nav :class="navbar.navClass" aria-label="主导航">
        <button
          v-for="item in config.links"
          :key="item.text"
          class="home-navbar__link"
          type="button"
          @click="navbar.handleNavClick(item.link)"
        >
          {{ item.text }}
        </button>
        <button class="home-navbar__search" type="button" @click="emit('openSearch'); navbar.closeMenu()">
          搜索
        </button>
        <button :class="['home-navbar__user', { 'home-navbar__user--avatar': navbar.isLoggedIn }]" type="button" @click="navbar.openUserPage">
          <UserAvatar
            v-if="navbar.isLoggedIn"
            :src="navbar.userAvatar"
            alt="用户头像"
            size="sm"
          />
          <span v-else>登录</span>
        </button>
      </nav>
    </div>
  </header>

  <AppDrawer
    v-if="props.showInfoMenu"
    v-model="navbar.infoMenuOpen"
    direction="ltr"
    size="360px"
  >
      <div class="mobile-drawer__header">
        <p>信息</p>
        <button class="mobile-drawer__close" type="button" @click="navbar.closeMenu">关闭</button>
      </div>
      <div class="mobile-drawer__body">
        <slot name="info-panel" />
      </div>
  </AppDrawer>

  <AppDrawer
    v-model="navbar.menuOpen"
    direction="rtl"
    size="360px"
    panel-class="home-mobile-drawer home-mobile-drawer--nav"
  >
      <div class="mobile-drawer__header">
        <p>菜单</p>
        <button class="mobile-drawer__close" type="button" @click="navbar.closeMenu">关闭</button>
      </div>
      <div class="mobile-drawer__body mobile-drawer__body--nav">
        <div class="mobile-drawer__search-row">
          <input
            v-model="navbar.mobileSearchKeyword"
            class="admin-input mobile-drawer__search-input"
            placeholder="搜索内容"
            @keydown.enter="navbar.submitMobileSearch"
          />
          <button class="button button--primary mobile-drawer__search-button" type="button" @click="navbar.submitMobileSearch">
            搜索
          </button>
        </div>
        <button
          v-for="item in config.links"
          :key="item.text"
          class="mobile-drawer__link"
          type="button"
          @click="navbar.handleNavClick(item.link)"
        >
          {{ item.text }}
        </button>
        <button class="mobile-drawer__link mobile-drawer__link--user" type="button" @click="navbar.openUserPage">
          <UserAvatar
            v-if="navbar.isLoggedIn"
            :src="navbar.userAvatar"
            alt="用户头像"
            size="sm"
          />
          <span>{{ navbar.isLoggedIn ? '用户中心' : '登录' }}</span>
        </button>
      </div>
  </AppDrawer>
</template>
