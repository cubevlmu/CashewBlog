<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import AppDialog from '@/components/AppDialog.vue'

const props = defineProps<{
  open: boolean
  initialValue?: string
}>()

const emit = defineEmits<{
  close: []
  submit: [keyword: string]
}>()

const keyword = ref(props.initialValue ?? '')

watch(
  () => props.initialValue,
  (value) => {
    keyword.value = value ?? ''
  },
)

const canSubmit = computed(() => keyword.value.trim().length > 0)

function handleSubmit() {
  if (!canSubmit.value) {
    return
  }

  emit('submit', keyword.value.trim())
}
</script>

<template>
  <AppDialog
    :model-value="open"
    width="720px"
    panel-class="search-overlay"
    :show-close="false"
    @close="emit('close')"
    @update:model-value="(value: boolean) => !value && emit('close')"
  >
    <template #header>
      <div class="search-overlay__header">
        <div>
          <p class="overlay-title">搜索文章</p>
          <p class="overlay-subtitle">支持标题、摘要、分类和标签关键字。</p>
        </div>
        <button class="button button--ghost" type="button" @click="emit('close')">关闭</button>
      </div>
    </template>

    <div class="search-overlay__form">
      <input
        v-model="keyword"
        class="admin-input"
        placeholder="输入关键词后回车"
        @keydown.enter="handleSubmit"
      />
      <button class="button button--primary" type="button" :disabled="!canSubmit" @click="handleSubmit">搜索</button>
    </div>
  </AppDialog>
</template>
