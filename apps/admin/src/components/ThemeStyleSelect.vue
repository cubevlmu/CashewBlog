<script setup lang="ts">
// Palette style picker that previews each style's real primary/secondary/tertiary colours.
import { computed } from "vue";
import Select from "primevue/select";
import { themeSwatches, type ThemeSpec, type ThemeStyle } from "../theme-colors";

const props = defineProps<{ modelValue: ThemeStyle; hue: number; themeSpec: ThemeSpec; labels: Record<string, string> }>();
const emit = defineEmits<{ "update:modelValue": [style: ThemeStyle] }>();

const styles: ThemeStyle[] = ["tonalSpot", "vibrant", "content", "expressive", "rainbow", "fruitSalad", "monochrome", "neutral", "fidelity"];
const options = computed(() =>
  styles.map((value) => {
    const colors = themeSwatches(props.hue, value, props.themeSpec);
    return { value, label: props.labels[value] ?? value, dots: [colors.primary, colors.secondary, colors.tertiary] };
  }),
);
const current = computed(() => options.value.find((option) => option.value === props.modelValue));
</script>

<template>
  <Select
    :model-value="modelValue"
    :options="options"
    option-label="label"
    option-value="value"
    class="w-full"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <template #value="{ placeholder }">
      <span v-if="current" class="flex items-center gap-2">
        <span class="flex -space-x-1">
          <span v-for="(dot, index) in current.dots" :key="index" class="size-4 rounded-full border border-white/60" :style="{ background: dot }" />
        </span>
        {{ current.label }}
      </span>
      <span v-else>{{ placeholder }}</span>
    </template>
    <template #option="{ option }">
      <span class="flex items-center gap-2">
        <span class="flex -space-x-1">
          <span v-for="(dot, index) in option.dots" :key="index" class="size-4 rounded-full border border-white/60" :style="{ background: dot }" />
        </span>
        {{ option.label }}
      </span>
    </template>
  </Select>
</template>
