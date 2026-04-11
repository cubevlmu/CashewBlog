<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'

import SiteFooter from '@/components/SiteFooter.vue'
import ThemeFab from '@/components/ThemeFab.vue'

const route = useRoute()
const showFooter = computed(() => route.meta.hideFooter !== true)
</script>

<template>
  <div class="app-shell">
    <main class="app-main">
      <RouterView />
    </main>
    <SiteFooter v-if="showFooter" />
    <ThemeFab />
  </div>
</template>
