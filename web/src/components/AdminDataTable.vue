<script setup lang="ts">
defineProps<{
  loading: boolean
  errorMessage: string
  hasRows: boolean
  emptyText: string
  colspan: number
  panelized?: boolean
}>()

defineEmits<{
  retry: []
}>()
</script>

<template>
  <section class="admin-posts" :class="{ panel: panelized !== false }">
    <div v-if="$slots.toolbar" class="admin-posts__toolbar">
      <slot name="toolbar" />
    </div>

    <div v-if="errorMessage" class="admin-posts__error">
      <p>{{ errorMessage }}</p>
      <button class="button button--primary" type="button" @click="$emit('retry')">重试</button>
    </div>

    <div v-else class="admin-table-wrap">
      <table class="admin-table">
        <thead>
          <slot name="head" />
        </thead>
        <tbody>
          <tr v-if="loading">
            <td :colspan="colspan" class="admin-table__empty">正在加载列表...</td>
          </tr>
          <tr v-else-if="!hasRows">
            <td :colspan="colspan" class="admin-table__empty">{{ emptyText }}</td>
          </tr>
          <slot v-else name="body" />
        </tbody>
      </table>
    </div>

    <slot name="footer" />
  </section>
</template>
