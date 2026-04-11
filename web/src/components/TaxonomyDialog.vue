<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import type { TaxonomyItem } from '@/types/site'

const props = defineProps<{
  open: boolean
  title: string
  type: 'tags' | 'categories'
  items: TaxonomyItem[]
}>()

const emit = defineEmits<{
  close: []
}>()

const keyword = ref('')

watch(
  () => props.open,
  (value) => {
    if (!value) {
      keyword.value = ''
    }
  },
)

const filteredItems = computed(() => {
  const normalized = keyword.value.trim().toLowerCase()
  return props.items.filter((item) => !normalized || item.name.toLowerCase().includes(normalized))
})
</script>

<template>
  <teleport to="body">
    <div v-if="open" class="overlay-shell" @click.self="emit('close')">
      <div class="overlay-card taxonomy-dialog">
        <div class="taxonomy-dialog__header">
          <div>
            <p class="overlay-title">{{ title }}</p>
            <p class="overlay-subtitle">输入关键字快速过滤。</p>
          </div>
          <button class="overlay-close" type="button" @click="emit('close')">关闭</button>
        </div>

        <input v-model="keyword" class="input" type="text" :placeholder="`搜索${title}`" />

        <div v-if="filteredItems.length > 0" class="taxonomy-dialog__chips">
          <RouterLink
            v-for="item in filteredItems"
            :key="item.slug"
            class="taxonomy-chip"
            :to="{ name: type === 'tags' ? 'tag' : 'category', params: { slug: item.slug } }"
            @click="emit('close')"
          >
            <span>{{ item.name }}</span>
            <span>{{ item.postCount }}</span>
          </RouterLink>
        </div>

        <p v-else class="empty-state">没有匹配的{{ title }}。</p>
      </div>
    </div>
  </teleport>
</template>
