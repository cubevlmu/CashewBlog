<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'

import SiteFooter from '@/components/SiteFooter.vue'
import ThemeFab from '@/components/ThemeFab.vue'
import { appStatusState } from '@/stores/appStatusStore'

const route = useRoute()
const showFooter = computed(() => route.meta.hideFooter !== true)
</script>

<template>
  <div class="app-shell">
    <div v-if="appStatusState.hasNotice" class="app-notice" role="status">
      <span>{{ appStatusState.noticeMessage }}</span>
      <RouterLink v-if="appStatusState.noticeKind === 'auth-expired'" class="app-notice__link" to="/login">
        去登录
      </RouterLink>
    </div>
    <main class="app-main">
      <RouterView />
    </main>
    <SiteFooter v-if="showFooter" />
    <ThemeFab />
  </div>
</template>
