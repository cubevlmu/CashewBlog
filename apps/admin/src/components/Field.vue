<script setup lang="ts">
import { onMounted, ref, useId } from "vue";
defineProps<{ label: string; hint?: string }>();
const root = ref<HTMLElement>(),
  id = useId(),
  target = ref(id);
onMounted(() => {
  const input = root.value?.querySelector<HTMLInputElement>(
    "input,textarea,select,[role=combobox]",
  );
  if (input) {
    input.id ||= id;
    target.value = input.id;
  }
});
</script>
<template>
  <div ref="root" class="mb-4 space-y-1">
    <label :for="target" class="text-sm font-medium">{{ label }}</label
    ><br /><slot /><br v-if="hint" /><small v-if="hint">{{ hint }}</small>
  </div>
</template>
