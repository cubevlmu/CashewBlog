<script setup lang="ts">
import { computed, ref } from "vue";
import { Icon } from "@iconify/vue";
import { iconOptions } from "./icon-picker";

const props = defineProps<{ modelValue: string | null }>();
const emit = defineEmits<{ "update:modelValue": [value: string] }>();
const visible = ref(false);
const query = ref("");
const selectedGroup = ref("全部");
const groups = ["全部", ...new Set(iconOptions.map((item) => item.group))];
const filtered = computed(() => {
  const text = query.value.trim().toLocaleLowerCase();
  return iconOptions.filter((item) =>
    (selectedGroup.value === "全部" || item.group === selectedGroup.value) &&
    (!text || `${item.label} ${item.id}`.toLocaleLowerCase().includes(text)),
  );
});
function choose(icon: string) {
  emit("update:modelValue", icon);
  visible.value = false;
}
</script>

<template>
  <div class="flex min-w-0 items-center gap-2">
    <Button type="button" severity="secondary" variant="outlined" class="min-w-0" @click="visible = true">
      <Icon v-if="modelValue" :icon="modelValue" class="size-5 shrink-0" />
      <i v-else class="pi pi-icons" />
      <span class="truncate">{{ modelValue || "选择图标" }}</span>
      <i class="pi pi-chevron-down text-xs" />
    </Button>
    <Button v-if="modelValue" type="button" icon="pi pi-times" text rounded severity="secondary" aria-label="清除图标" @click="emit('update:modelValue', '')" />
    <Dialog v-model:visible="visible" modal maximizable header="选择图标" :style="{ width: 'min(56rem, 96vw)' }">
      <div class="mb-4 flex flex-col gap-3 sm:flex-row">
        <InputText v-model="query" autofocus placeholder="搜索图标名称或关键词" class="w-full flex-1" />
        <SelectButton v-model="selectedGroup" :options="groups" aria-label="图标分类" />
      </div>
      <div class="grid max-h-[min(60vh,36rem)] grid-cols-3 gap-2 overflow-y-auto sm:grid-cols-4 md:grid-cols-6">
        <button v-for="item in filtered" :key="item.id" type="button" class="flex min-h-20 flex-col items-center justify-center gap-2 rounded-lg border border-surface-200 bg-surface-0 p-2 text-center transition-colors hover:border-primary hover:bg-primary-50 dark:border-surface-700 dark:bg-surface-900 dark:hover:bg-surface-800" :class="modelValue === item.id ? 'border-primary bg-primary-50 dark:bg-surface-800' : ''" :title="`${item.label} (${item.id})`" @click="choose(item.id)">
          <Icon :icon="item.id" class="size-6" />
          <span class="line-clamp-2 text-xs">{{ item.label }}</span>
        </button>
        <div v-if="filtered.length === 0" class="col-span-full py-12 text-center text-sm text-muted-color">没有匹配的图标</div>
      </div>
      <template #footer>
        <span class="mr-auto truncate text-xs text-muted-color">{{ modelValue ? `当前：${modelValue}` : "选择后会保存到设置中" }}</span>
        <Button label="关闭" severity="secondary" text @click="visible = false" />
      </template>
    </Dialog>
  </div>
</template>
