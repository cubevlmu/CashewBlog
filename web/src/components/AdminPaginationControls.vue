<script setup lang="ts">
import { ref, watch } from 'vue'

const props = defineProps<{
  page: number
  totalPages: number
  totalCount: number
}>()

const emit = defineEmits<{
  change: [page: number]
}>()

const jumpPageInput = ref(String(props.page))

watch(() => props.page, (page) => {
  jumpPageInput.value = String(page)
})

function pageNumbers() {
  const start = Math.max(1, props.page - 2)
  const end = Math.min(props.totalPages, start + 4)
  return Array.from({ length: end - start + 1 }, (_, index) => start + index)
}

function jumpToPage() {
  const nextPage = Number(jumpPageInput.value)
  if (!Number.isFinite(nextPage)) {
    jumpPageInput.value = String(props.page)
    return
  }

  emit('change', Math.min(props.totalPages, Math.max(1, nextPage)))
}
</script>

<template>
  <div class="admin-pagination">
    <div class="admin-pagination__summary">共 {{ totalCount }} 项，第 {{ page }} / {{ totalPages }} 页</div>
    <div class="admin-pagination__controls">
      <button class="button button--ghost" type="button" :disabled="page <= 1" @click="$emit('change', page - 1)">上一页</button>
      <button
        v-for="pageNumber in pageNumbers()"
        :key="pageNumber"
        class="button"
        :class="pageNumber === page ? 'button--primary' : 'button--ghost'"
        type="button"
        @click="$emit('change', pageNumber)"
      >
        {{ pageNumber }}
      </button>
      <button class="button button--ghost" type="button" :disabled="page >= totalPages" @click="$emit('change', page + 1)">下一页</button>
      <div class="admin-pagination__jump">
        <input v-model="jumpPageInput" class="admin-input admin-input--page" type="number" min="1" :max="totalPages" />
        <button class="button button--ghost" type="button" @click="jumpToPage">跳转</button>
      </div>
    </div>
  </div>
</template>
