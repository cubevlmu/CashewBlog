<script setup lang="ts">
// Block insertion list shared by the `/` menu, the toolbar insert button and the mobile
// drawer. Keyboard navigation is driven by the editor so focus can stay in the text.
import Button from "primevue/button";
import type { InsertItem } from "../editor/editor-commands";

defineProps<{ items: InsertItem[]; highlighted?: number }>();
const emit = defineEmits<{ select: [key: string] }>();
</script>

<template>
  <div role="listbox" aria-label="插入内容" class="grid max-h-[min(22rem,60dvh)] grid-cols-2 gap-1 overflow-y-auto sm:grid-cols-1">
    <Button
      v-for="(item, index) in items"
      :key="item.key"
      role="option"
      :aria-selected="index === highlighted"
      :label="item.label"
      :icon="item.icon"
      text
      :severity="index === highlighted ? 'primary' : 'secondary'"
      class="min-h-11 !justify-start sm:min-h-9"
      :class="{ '!bg-[var(--p-highlight-background)]': index === highlighted }"
      @mousedown.prevent
      @click="emit('select', item.key)"
    />
    <p v-if="!items.length" class="col-span-2 m-0 p-3 text-sm text-[var(--p-text-muted-color)] sm:col-span-1">没有匹配的内容类型</p>
  </div>
</template>
