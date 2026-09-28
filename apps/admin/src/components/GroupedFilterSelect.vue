<script setup lang="ts">
import { computed } from "vue";

const props = defineProps<{
  /** Selected values; each entry is prefixed with its group, e.g. `status:draft`. */
  modelValue: string[];
  groups: { label: string; items: { label: string; value: string }[] }[];
  /** Accessible name of the combobox. */
  label: string;
  placeholder?: string;
  /** Screen-reader label for the chip shown once something is selected. */
  chipIcon?: string;
}>();
const emit = defineEmits<{
  "update:modelValue": [value: string[]];
  change: [];
}>();

const allOptions = computed(() => props.groups.flatMap((group) => group.items));
const summary = computed(() => {
  const labels = props.modelValue.map(
    (value) =>
      allOptions.value.find((item) => item.value === value)?.label ?? value,
  );
  return labels.length > 1
    ? `${labels[0]} +${labels.length - 1}`
    : (labels[0] ?? "");
});

/** Every group drives one API parameter, so a new pick replaces the previous one. */
function updateSelection(values: string[]) {
  const seen = new Set<string>();
  emit(
    "update:modelValue",
    [...values]
      .reverse()
      .filter((value) => {
        const group = value.slice(0, value.indexOf(":"));
        if (seen.has(group)) return false;
        seen.add(group);
        return true;
      })
      .reverse(),
  );
  emit("change");
}
function clearSelection() {
  emit("update:modelValue", []);
  emit("change");
}
</script>
<template>
  <Select
    :model-value="props.modelValue"
    :options="props.groups"
    multiple
    filter
    option-group-label="label"
    option-group-children="items"
    option-label="label"
    option-value="value"
    filter-placeholder="搜索筛选条件"
    :aria-label="props.label"
    class="w-full sm:w-64"
    @update:model-value="updateSelection"
  >
    <template #header>
      <div class="flex items-center gap-1 px-3 pt-2">
        <Button
          label="清空"
          text
          size="small"
          severity="secondary"
          @click="clearSelection"
        />
      </div>
    </template>
    <template #value>
      <span
        v-if="props.modelValue.length"
        class="inline-flex items-center gap-1 rounded-full bg-[var(--p-primary-50)] px-3 py-1 text-xs font-semibold text-[var(--p-primary-700)]"
        ><i :class="props.chipIcon ?? 'pi pi-sliders-h'" />{{ summary }}</span
      ><span v-else class="text-[var(--p-text-muted-color)]">{{
        props.placeholder ?? "筛选"
      }}</span>
    </template>
    <template #optiongroup="slotProps">
      <span
        class="text-xs font-semibold uppercase tracking-wide text-[var(--p-text-muted-color)]"
        >{{ slotProps.option.label }}</span
      >
    </template>
    <template #option="slotProps">
      <div class="flex items-center gap-2">
        <Checkbox
          :model-value="props.modelValue.includes(slotProps.option.value)"
          binary
          :tabindex="-1"
          readonly
        /><span class="truncate">{{ slotProps.option.label }}</span>
      </div>
    </template>
  </Select>
</template>
