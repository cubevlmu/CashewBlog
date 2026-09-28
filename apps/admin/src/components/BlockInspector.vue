<script setup lang="ts">
// Actions and properties of one block. Rendered inside a desktop Popover or the mobile
// bottom Drawer, so every action is reachable without hover.
import { computed, reactive, watch } from "vue";
import Button from "primevue/button";
import Divider from "primevue/divider";
import InputText from "primevue/inputtext";
import { BLOCK_TYPES, blockType, type BlockType } from "../editor/editor-commands";
import { parseImage, type ImageModel } from "../editor/markdown-blocks";
import { rawLabel, type MarkdownBlock } from "../editor/markdown-document";

const props = defineProps<{ block: MarkdownBlock; index: number; count: number; uploading: boolean }>();
const emit = defineEmits<{
  convert: [type: BlockType];
  move: [delta: -1 | 1];
  duplicate: [];
  remove: [];
  insert: [];
  source: [];
  image: [model: ImageModel];
  replace: [];
}>();

const type = computed(() => blockType(props.block));
const image = reactive<ImageModel>({ alt: "", url: "", title: "" });
watch(
  () => props.block.source,
  () => Object.assign(image, parseImage(props.block.source) ?? { alt: "", url: "", title: "" }),
  { immediate: true },
);
const kindLabel = computed(() => {
  switch (props.block.kind) {
    case "image":
      return "图片";
    case "table":
      return "表格";
    case "thematic-break":
      return "分割线";
    case "raw":
      return rawLabel(props.block.source);
    default:
      return BLOCK_TYPES.find((item) => item.value === type.value)?.label ?? "内容块";
  }
});
const action = "min-h-11 !justify-start sm:min-h-9";
</script>

<template>
  <div class="flex w-full flex-col gap-2 sm:w-72">
    <div class="text-sm font-semibold">{{ kindLabel }}</div>

    <template v-if="type">
      <div class="text-xs text-[var(--p-text-muted-color)]">转换为</div>
      <div class="grid grid-cols-3 gap-1">
        <Button
          v-for="item in BLOCK_TYPES"
          :key="item.value"
          :label="item.label"
          size="small"
          :outlined="item.value !== type"
          :severity="item.value === type ? 'primary' : 'secondary'"
          class="min-h-11 !px-1 !text-xs sm:min-h-8"
          @click="emit('convert', item.value)"
        />
      </div>
    </template>

    <form v-if="block.kind === 'image'" class="flex flex-col gap-2" @submit.prevent="emit('image', { ...image })">
      <label class="flex flex-col gap-1 text-xs">
        替代文本（可含宽度令牌，如 w-60%）
        <InputText v-model="image.alt" size="small" />
      </label>
      <label class="flex flex-col gap-1 text-xs">
        图片地址
        <InputText v-model="image.url" size="small" />
      </label>
      <label class="flex flex-col gap-1 text-xs">
        标题（可选）
        <InputText v-model="image.title" size="small" />
      </label>
      <div class="flex gap-2">
        <Button type="submit" label="应用" icon="pi pi-check" size="small" class="min-h-11 sm:min-h-8" />
        <Button label="替换图片" icon="pi pi-upload" size="small" outlined :loading="uploading" :disabled="uploading" class="min-h-11 sm:min-h-8" @click="emit('replace')" />
      </div>
    </form>

    <Button v-if="block.kind === 'raw'" label="编辑源码" icon="pi pi-file-edit" outlined size="small" :class="action" @click="emit('source')" />

    <Divider class="!my-1" />
    <div class="grid grid-cols-2 gap-1">
      <Button label="上移" icon="pi pi-arrow-up" text severity="secondary" size="small" :class="action" :disabled="index === 0" @click="emit('move', -1)" />
      <Button label="下移" icon="pi pi-arrow-down" text severity="secondary" size="small" :class="action" :disabled="index >= count - 1" @click="emit('move', 1)" />
      <Button label="在下方插入" icon="pi pi-plus" text severity="secondary" size="small" :class="action" @click="emit('insert')" />
      <Button label="复制" icon="pi pi-copy" text severity="secondary" size="small" :class="action" @click="emit('duplicate')" />
      <Button label="删除" icon="pi pi-trash" text severity="danger" size="small" :class="action" @click="emit('remove')" />
    </div>
  </div>
</template>
