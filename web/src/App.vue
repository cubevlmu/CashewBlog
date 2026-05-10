<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'

import NoticeView from '@/components/NoticeView.vue'
import SiteFooter from '@/components/SiteFooter.vue'
import ThemeFab from '@/components/ThemeFab.vue'
import { appStatusState } from '@/stores/appStatusStore'

const route = useRoute()
const showFooter = computed(() => route.meta.hideFooter !== true)
const appNotice = computed(() => {
  if (appStatusState.noticeKind === 'backend-error') {
    return {
      emoji: '🛠️',
      title: '后端服务异常',
      tips: '服务暂时不可用，请稍后刷新页面重试。',
    }
  }

  if (appStatusState.noticeKind === 'auth-expired') {
    return {
      emoji: '🔐',
      title: '登录状态异常',
      tips: appStatusState.noticeMessage || '登录已失效，请重新登录。',
    }
  }

  return null
})
</script>

<template>
  <div class="app-shell">
    <div v-if="appNotice" class="app-notice">
      <NoticeView :emoji="appNotice.emoji" :title="appNotice.title" :tips="appNotice.tips">
        <RouterLink v-if="appStatusState.noticeKind === 'auth-expired'" class="app-notice__link" to="/login">
          去登录
        </RouterLink>
      </NoticeView>
    </div>
    <main class="app-main">
      <RouterView />
    </main>
    <SiteFooter v-if="showFooter" />
    <ThemeFab />
  </div>
</template>
