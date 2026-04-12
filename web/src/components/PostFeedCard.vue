<script setup lang="ts">
import { computed, ref } from 'vue'

import UserAvatar from '@/components/UserAvatar.vue'
import type { HomePostCard } from '@/types/site'

const props = defineProps<{
  post: HomePostCard
}>()

const emit = defineEmits<{
  select: [id: number]
}>()

const imageError = ref(false)

const cardStyle = computed(() =>
  imageError.value
    ? undefined
    : {
        backgroundImage: `linear-gradient(180deg, rgba(17,24,39,0.06), rgba(17,24,39,0.72)), url(${props.post.coverImage})`,
      },
)

const formattedDate = computed(() =>
  new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium' }).format(new Date(props.post.publishedAt)),
)
</script>

<template>
  <article class="feed-card">
    <RouterLink class="feed-card__media" :style="cardStyle" :to="`/article/${post.id}`" @click="emit('select', post.id)">
      <img class="feed-card__img-fallback" :src="post.coverImage" alt="" @error="imageError = true" />
      <span class="feed-card__badge" :class="{ 'is-pinned': post.isPinned }">
        {{ post.isPinned ? '置顶' : post.category.name }}
      </span>
      <div class="feed-card__headline">
        <h3>{{ post.title }}</h3>
      </div>
    </RouterLink>

    <div class="feed-card__body">
      <p class="feed-card__desc">{{ post.desc }}</p>

      <div class="feed-card__meta">
        <span class="feed-card__author">
          <UserAvatar :src="post.author.avatar" :alt="post.author.displayName" size="xs" shape="rounded" />
          <span>{{ post.author.displayName }}</span>
        </span>
        <span>{{ formattedDate }}</span>
        <span>{{ post.readingTime }} 分钟</span>
        <span>{{ post.viewCount }} 阅读</span>
      </div>

      <div class="feed-card__tags">
        <RouterLink
          v-for="tag in post.tags"
          :key="tag.slug"
          class="feed-card__tag"
          :to="{ name: 'tag', params: { slug: tag.slug } }"
        >
          # {{ tag.name }}
        </RouterLink>
      </div>
    </div>
  </article>
</template>
