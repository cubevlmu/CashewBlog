<script setup lang="ts">
// Formatting toolbar. Buttons prevent mousedown so the text selection survives the click.
// On narrow screens only the essentials stay inline (44px hit areas) and the rest moves
// into the "…" menu, so the bar never overflows.
import { computed, ref } from "vue";
import Button from "primevue/button";
import ButtonGroup from "primevue/buttongroup";
import Menu from "primevue/menu";
import Select from "primevue/select";
import Toolbar from "primevue/toolbar";
import type { MenuItem } from "primevue/menuitem";
import { BLOCK_TYPES, type BlockType, type MarkCommand } from "../editor/editor-commands";

const props = defineProps<{
  type: BlockType | null;
  canUndo: boolean;
  canRedo: boolean;
  uploading: boolean;
  compact: boolean;
}>();
const emit = defineEmits<{
  undo: [];
  redo: [];
  type: [value: BlockType];
  mark: [command: MarkCommand];
  link: [];
  insert: [event: MouseEvent];
  actions: [anchor: HTMLElement | undefined];
  upload: [kind: "image" | "file"];
}>();

// PrimeIcons has no text-format glyphs, so marks use styled letters.
const marks: { command: MarkCommand; glyph: string; glyphClass: string; label: string; essential: boolean }[] = [
  { command: "bold", glyph: "B", glyphClass: "font-bold", label: "加粗 (Ctrl+B)", essential: true },
  { command: "italic", glyph: "I", glyphClass: "font-serif italic", label: "斜体 (Ctrl+I)", essential: true },
  { command: "strike", glyph: "S", glyphClass: "line-through", label: "删除线 (Ctrl+Shift+X)", essential: false },
  { command: "code", glyph: "</>", glyphClass: "font-mono text-xs", label: "行内代码 (Ctrl+E)", essential: false },
];
const visibleMarks = computed(() => marks.filter((mark) => mark.essential || !props.compact));

const more = ref<InstanceType<typeof Menu>>();
const moreButton = ref<{ $el: HTMLElement }>();
const moreItems = computed<MenuItem[]>(() => [
  ...(props.compact
    ? [
        { label: "撤销", icon: "pi pi-undo", disabled: !props.canUndo, command: () => emit("undo") },
        { label: "重做", icon: "pi pi-refresh", disabled: !props.canRedo, command: () => emit("redo") },
        { separator: true },
        { label: "删除线", icon: "pi pi-minus", command: () => emit("mark", "strike") },
        { label: "行内代码", icon: "pi pi-code", command: () => emit("mark", "code") },
        { label: "链接…", icon: "pi pi-link", command: () => emit("link") },
        { separator: true },
        { label: "上传图片", icon: "pi pi-image", disabled: props.uploading, command: () => emit("upload", "image") },
        { label: "上传附件", icon: "pi pi-paperclip", disabled: props.uploading, command: () => emit("upload", "file") },
        { separator: true },
      ]
    : []),
  { label: "当前块操作…", icon: "pi pi-sliders-h", command: () => emit("actions", moreButton.value?.$el) },
]);
const button = "min-h-11 min-w-11 sm:min-h-9 sm:min-w-9";
</script>

<template>
  <Toolbar class="md-toolbar sticky top-0 z-10 !flex-nowrap !rounded-none !border-x-0 !px-2 !py-1">
    <template #start>
      <div class="flex min-w-0 items-center gap-1">
        <ButtonGroup v-if="!compact">
          <Button icon="pi pi-undo" text severity="secondary" :class="button" :disabled="!canUndo" aria-label="撤销 (Ctrl+Z)" title="撤销 (Ctrl+Z)" @mousedown.prevent @click="emit('undo')" />
          <Button text severity="secondary" :class="button" :disabled="!canRedo" aria-label="重做 (Ctrl+Shift+Z)" title="重做 (Ctrl+Shift+Z)" @mousedown.prevent @click="emit('redo')">
            <i class="pi pi-undo -scale-x-100" aria-hidden="true" />
          </Button>
        </ButtonGroup>
        <Select
          :model-value="type"
          :options="BLOCK_TYPES"
          option-label="label"
          option-value="value"
          :disabled="!type"
          :placeholder="compact ? '类型' : '块类型'"
          aria-label="块类型"
          :class="compact ? 'w-24 shrink-0' : 'w-28 shrink-0'"
          @update:model-value="emit('type', $event)"
        />
        <ButtonGroup>
          <Button
            v-for="mark in visibleMarks"
            :key="mark.command"
            text
            severity="secondary"
            :class="button"
            :aria-label="mark.label"
            :title="mark.label"
            @mousedown.prevent
            @click="emit('mark', mark.command)"
          >
            <span :class="mark.glyphClass" aria-hidden="true">{{ mark.glyph }}</span>
          </Button>
          <Button v-if="!compact" icon="pi pi-link" text severity="secondary" :class="button" aria-label="链接 (Ctrl+K)" title="链接 (Ctrl+K)" @mousedown.prevent @click="emit('link')" />
        </ButtonGroup>
        <ButtonGroup v-if="!compact">
          <Button icon="pi pi-image" text severity="secondary" :class="button" :loading="uploading" :disabled="uploading" aria-label="上传图片" title="上传图片" @mousedown.prevent @click="emit('upload', 'image')" />
          <Button icon="pi pi-paperclip" text severity="secondary" :class="button" :disabled="uploading" aria-label="上传附件" title="上传附件" @mousedown.prevent @click="emit('upload', 'file')" />
        </ButtonGroup>
        <Button icon="pi pi-plus" :label="compact ? undefined : '插入'" text severity="secondary" :class="button" aria-label="插入内容块" title="插入内容块 (输入 / 也可打开)" @mousedown.prevent @click="emit('insert', $event)" />
      </div>
    </template>
    <template #end>
      <Button ref="moreButton" icon="pi pi-ellipsis-h" text severity="secondary" :class="button" aria-label="更多操作" title="更多操作" aria-haspopup="true" @mousedown.prevent @click="more?.toggle($event)" />
      <Menu ref="more" :model="moreItems" popup />
    </template>
  </Toolbar>
</template>
