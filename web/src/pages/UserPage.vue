<script setup lang="ts">
import { reactive } from 'vue'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
import { faArrowLeft, faArrowRightFromBracket, faUserShield } from '@fortawesome/free-solid-svg-icons'
import { useRouter } from 'vue-router'

import PostFeedCard from '@/components/PostFeedCard.vue'
import { useUserPage } from '@/composables/useUserPage'

withDefaults(defineProps<{
  embedded?: boolean
}>(), {
  embedded: false,
})

const router = useRouter()
const userPage = reactive(useUserPage())
</script>

<template>
  <section :class="embedded ? 'embedded-panel' : 'page-shell'">
    <div :class="embedded ? 'embedded-panel__inner' : 'container page-shell__inner'">
      <div class="page-shell__title-block">
        <div class="content-title-row">
          <button class="content-back" type="button" @click="router.back()">
            <FontAwesomeIcon :icon="faArrowLeft" />
          </button>
          <h1>用户中心</h1>
        </div>
        <p class="eyebrow">Profile</p>
        <p class="page-shell__lead">查看当前登录用户的资料信息，以及这个账号发布过的文章。</p>
      </div>

      <div v-if="userPage.currentUser" class="user-profile panel">
        <div class="user-profile__hero">
          <img class="user-profile__avatar" :src="userPage.currentUser.avatar" :alt="userPage.currentUser.displayName" />
          <div class="user-profile__copy">
            <p class="panel__label">当前登录用户</p>
            <h2>{{ userPage.currentUser.displayName }}</h2>
            <p class="user-profile__bio">{{ userPage.currentUser.bio }}</p>
          </div>
        </div>

        <div class="user-profile__meta">
          <div class="user-profile__meta-item">
            <span>用户名</span>
            <strong>{{ userPage.currentUser.username }}</strong>
          </div>
          <div class="user-profile__meta-item">
            <span>昵称</span>
            <strong>{{ userPage.currentUser.displayName }}</strong>
          </div>
          <div class="user-profile__meta-item">
            <span>用户组</span>
            <strong>{{ userPage.roleLabel }}</strong>
          </div>
          <div class="user-profile__meta-item">
            <span>邮箱</span>
            <strong>{{ userPage.currentUser.email }}</strong>
          </div>
          <div class="user-profile__meta-item">
            <span>性别</span>
            <strong>{{ userPage.genderLabel }}</strong>
          </div>
        </div>

        <div class="user-actions">
          <RouterLink v-if="userPage.canEnterAdmin" class="button button--ghost" to="/admin/dashboard">
            <FontAwesomeIcon :icon="faUserShield" />
            <span>{{ userPage.authState.isAdmin ? '进入后台' : '后台面板' }}</span>
          </RouterLink>
          <button class="button button--ghost" type="button" @click="userPage.handleLogout">
            <FontAwesomeIcon :icon="faArrowRightFromBracket" />
            <span>退出登录</span>
          </button>
        </div>
      </div>

      <div v-if="userPage.debugEnabled" class="panel user-debug">
        <p class="panel__label">Debug</p>
        <h3>本地调试会话</h3>
        <div class="user-debug__grid">
          <div class="user-profile__meta-item">
            <span>Access Token</span>
            <strong>{{ userPage.authComputed.token }}</strong>
          </div>
          <div class="user-profile__meta-item">
            <span>Refresh Token</span>
            <strong>{{ userPage.authComputed.refreshToken }}</strong>
          </div>
          <div class="user-profile__meta-item">
            <span>Session Token</span>
            <strong>{{ userPage.authComputed.sessionToken }}</strong>
          </div>
          <div class="user-profile__meta-item">
            <span>登录状态</span>
            <strong>{{ userPage.authState.isLoggedIn ? '已登录' : '未登录' }}</strong>
          </div>
        </div>
      </div>

      <div class="page-shell__title-block user-posts__heading">
        <h2>用户文章</h2>
        <p class="page-shell__lead">当前账号共发布 {{ userPage.total }} 篇文章，使用分页查看。</p>
      </div>

      <div v-if="userPage.loading && userPage.posts.length === 0" class="feed-skeleton">
        <div v-for="index in 3" :key="index" class="feed-skeleton__item" />
      </div>

      <div v-else-if="userPage.errorMessage" class="panel">
        <p class="panel__label">加载失败</p>
        <p class="panel__text">{{ userPage.errorMessage }}</p>
        <button class="button button--primary" type="button" @click="userPage.load(1)">重试</button>
      </div>

      <template v-else-if="userPage.posts.length > 0">
        <div class="feed-grid">
          <PostFeedCard v-for="post in userPage.posts" :key="post.id" :post="post" />
        </div>
        <div class="comment-pagination">
          <button class="button button--ghost" type="button" :disabled="!userPage.hasPreviousPage || userPage.loading" @click="userPage.goToPreviousPage">
            上一页
          </button>
          <span class="comment-pagination__text">第 {{ userPage.page }} / {{ userPage.totalPages }} 页</span>
          <button class="button button--ghost" type="button" :disabled="!userPage.hasNextPage || userPage.loading" @click="userPage.goToNextPage">
            下一页
          </button>
        </div>
      </template>

      <div v-else class="panel">
        <p class="empty-state">当前用户还没有发布文章。</p>
      </div>
    </div>
  </section>
</template>
