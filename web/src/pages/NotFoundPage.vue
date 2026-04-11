<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'

import { loadPublicSiteConfig } from '@/controllers/publicController'
import HomeNavbar from '@/components/HomeNavbar.vue'
import SearchOverlay from '@/components/SearchOverlay.vue'
import type { HomeConfig } from '@/types/site'

const router = useRouter()
const homeConfig = ref<HomeConfig | null>(null)
const searchOpen = ref(false)

onMounted(async () => {
  homeConfig.value = await loadPublicSiteConfig()
})

function submitSearch(keyword: string) {
  searchOpen.value = false
  void router.push({ name: 'search', query: { q: keyword } })
}
</script>

<template>
  <div class="not-found-page">
    <HomeNavbar
      v-if="homeConfig"
      :config="homeConfig.navbar"
      @open-search="searchOpen = true"
    />

    <section class="not-found-hero">
      <div class="container not-found-hero__inner">
        <div class="not-found-card">
          <div class="not-found-card__icon" aria-hidden="true">
            <span>404</span>
            <span>🧭</span>
          </div>
          <h1>页面走丢了</h1>
          <p>你访问的地址没有匹配到内容，可能链接失效了，或者这篇文章还没有发布。</p>
          <div class="not-found-card__actions">
            <RouterLink class="button button--primary" to="/">返回首页</RouterLink>
            <button class="button button--ghost" type="button" @click="searchOpen = true">搜索</button>
          </div>
        </div>
      </div>
    </section>

    <SearchOverlay :open="searchOpen" @close="searchOpen = false" @submit="submitSearch" />
  </div>
</template>
