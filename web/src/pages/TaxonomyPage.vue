<script setup lang="ts">
import { reactive } from 'vue'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
import { faArrowLeft } from '@fortawesome/free-solid-svg-icons'
import { useRouter } from 'vue-router'

import PostFeedCard from '@/components/PostFeedCard.vue'
import { useTaxonomyPage } from '@/composables/useTaxonomyPage'

withDefaults(defineProps<{
  embedded?: boolean
}>(), {
  embedded: false,
})

const router = useRouter()
const taxonomy = reactive(useTaxonomyPage())
</script>

<template>
  <section :class="embedded ? 'embedded-panel' : 'page-shell'">
    <div :class="embedded ? 'embedded-panel__inner' : 'container page-shell__inner'">
      <div class="page-shell__title-block">
        <div class="content-title-row">
          <button class="content-back" type="button" @click="router.back()">
            <FontAwesomeIcon :icon="faArrowLeft" />
          </button>
          <h1>{{ taxonomy.isListPage ? `${taxonomy.title}总览` : taxonomy.item?.name ?? taxonomy.slug }}</h1>
        </div>
        <p class="eyebrow">{{ taxonomy.title }}</p>
        <p v-if="taxonomy.loading && !taxonomy.isListPage" class="page-shell__lead">正在加载{{ taxonomy.title }}相关文章...</p>
        <p v-else class="page-shell__lead">
          <template v-if="taxonomy.isListPage">当前共收录 {{ taxonomy.items.length }} 个{{ taxonomy.title }}。</template>
          <template v-else-if="taxonomy.item">当前{{ taxonomy.title }}下共有 {{ taxonomy.total }} 篇相关文章。</template>
          <template v-else>没有找到对应{{ taxonomy.title }}。</template>
        </p>
      </div>

      <div v-if="taxonomy.errorMessage" class="panel">
        <p class="panel__label">加载失败</p>
        <p class="panel__text">{{ taxonomy.errorMessage }}</p>
        <button class="button button--primary" type="button" @click="taxonomy.load(true)">重试</button>
      </div>

      <template v-else-if="taxonomy.isListPage">
        <div v-if="taxonomy.items.length > 0" class="taxonomy-dialog__chips">
          <RouterLink
            v-for="entry in taxonomy.items"
            :key="entry.slug"
            class="taxonomy-chip"
            :to="{ name: taxonomy.kind === 'tags' ? 'tag' : 'category', params: { slug: entry.slug } }"
          >
            <span>{{ entry.name }}</span>
            <span>{{ entry.postCount }}</span>
          </RouterLink>
        </div>
        <div v-else-if="!taxonomy.loading" class="panel">
          <p class="empty-state">当前还没有可用的{{ taxonomy.title }}。</p>
        </div>
      </template>

      <template v-else-if="taxonomy.loading && taxonomy.posts.length === 0">
        <div class="feed-skeleton">
          <div v-for="index in 3" :key="index" class="feed-skeleton__item" />
        </div>
      </template>

      <template v-else-if="taxonomy.posts.length > 0">
        <div class="feed-grid">
          <PostFeedCard v-for="post in taxonomy.posts" :key="post.id" :post="post" />
        </div>
        <div ref="taxonomy.sentinel" class="feed-sentinel" />
        <p v-if="taxonomy.loading" class="feed-status">正在加载更多文章...</p>
        <p v-else-if="!taxonomy.canLoadMore" class="feed-status">已经到底了。</p>
      </template>

      <div v-else class="panel">
        <p class="empty-state">这个{{ taxonomy.title }}下还没有文章。</p>
      </div>
    </div>
  </section>
</template>
