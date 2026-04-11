<script setup lang="ts">
defineProps<{
  description: string
  loading?: boolean
  confirmText?: string
}>()

defineEmits<{
  confirm: []
  cancel: []
}>()
</script>

<template>
  <div class="admin-confirm">
    <p>{{ description }}</p>
    <div class="admin-confirm__actions">
      <button class="button button--ghost" type="button" :disabled="loading" @click="$emit('cancel')">取消</button>
      <button class="button button--danger" type="button" :disabled="loading" @click="$emit('confirm')">
        {{ loading ? '处理中...' : (confirmText || '确认') }}
      </button>
    </div>
  </div>
</template>
