<script setup lang="ts">
import { reactive } from 'vue'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
import { faArrowLeft } from '@fortawesome/free-solid-svg-icons'
import { useRouter } from 'vue-router'

import PostFeedCard from '@/components/PostFeedCard.vue'
import SearchOverlay from '@/components/SearchOverlay.vue'
import { useSearchPage } from '@/composables/useSearchPage'

withDefaults(defineProps<{
  embedded?: boolean
}>(), {
  embedded: false,
})

const router = useRouter()
const search = reactive(useSearchPage())
</script>

<template>
  <section :class="embedded ? 'embedded-panel' : 'page-shell'">
    <div :class="embedded ? 'embedded-panel__inner' : 'container page-shell__inner'">
      <div class="page-shell__header">
        <div class="page-shell__title-block">
          <div class="content-title-row">
            <button class="content-back" type="button" @click="router.back()">
              <FontAwesomeIcon :icon="faArrowLeft" />
            </button>
            <h1>搜索结果</h1>
          </div>
          <p class="eyebrow">Search</p>
          <p class="page-shell__lead">
            <template v-if="search.keyword">关键词 “{{ search.keyword }}” 共找到 {{ search.total }} 条结果。</template>
            <template v-else>输入关键词后查看搜索结果。</template>
          </p>
        </div>
        <button class="button button--primary" type="button" @click="search.overlayOpen = true">搜索</button>
      </div>

      <div v-if="search.loading && search.results.length === 0" class="feed-skeleton">
        <div v-for="index in 3" :key="index" class="feed-skeleton__item" />
      </div>

      <div v-else-if="search.errorMessage" class="panel">
        <p class="panel__label">搜索失败</p>
        <p class="panel__text">{{ search.errorMessage }}</p>
        <button class="button button--primary" type="button" @click="search.load(true)">重试</button>
      </div>

      <div v-else-if="search.results.length === 0" class="panel">
        <p class="empty-state">没有找到匹配的文章。</p>
      </div>

      <template v-else>
        <div class="feed-grid">
          <PostFeedCard v-for="post in search.results" :key="post.id" :post="post" />
        </div>
        <div ref="search.sentinel" class="feed-sentinel" />
        <p v-if="search.loading" class="feed-status">正在加载更多结果...</p>
        <p v-else-if="!search.canLoadMore" class="feed-status">已经到底了。</p>
      </template>
    </div>

    <SearchOverlay
      :open="search.overlayOpen"
      :initial-value="search.keyword"
      @close="search.overlayOpen = false"
      @submit="search.submitSearch"
    />
  </section>
</template>
