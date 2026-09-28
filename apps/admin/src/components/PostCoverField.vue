<script setup lang="ts">
defineProps<{ src: string }>();
defineEmits<{ choose: []; remove: [] }>();
</script>

<template>
  <div
    v-if="src"
    class="group relative mb-3 overflow-hidden rounded-xl border border-[var(--p-content-border-color)] bg-[var(--p-surface-100)]"
  >
    <img :src="src" alt="文章封面" class="max-h-56 w-full object-cover" />
    <div
      class="absolute inset-0 flex items-center justify-center gap-2 bg-black/45 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100"
    >
      <Button
        icon="pi pi-image"
        label="更换封面"
        size="small"
        severity="contrast"
        @click="$emit('choose')"
      />
      <Button
        icon="pi pi-trash"
        label="删除"
        size="small"
        severity="danger"
        @click="$emit('remove')"
      />
    </div>
  </div>
  <Button
    v-else
    label="选择封面"
    icon="pi pi-image"
    severity="secondary"
    outlined
    class="mb-3 w-full"
    @click="$emit('choose')"
  />
</template>
