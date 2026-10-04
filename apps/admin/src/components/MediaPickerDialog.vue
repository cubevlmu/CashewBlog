<script setup lang="ts">
// Shared media picker dialog (editor insert, post cover, settings images). Wraps MediaView in
// picker mode; the library only mounts while the dialog is open.
import { defineAsyncComponent } from "vue";
import type { MediaAssetDto } from "../api/types";

const MediaView = defineAsyncComponent(() => import("../views/MediaView.vue"));
const visible = defineModel<boolean>("visible", { required: true });
defineProps<{ header: string; imagesOnly?: boolean }>();
const emit = defineEmits<{ select: [asset: MediaAssetDto]; hide: [] }>();
function select(asset: MediaAssetDto) {
  visible.value = false;
  emit("select", asset);
}
</script>
<template>
  <Dialog
    v-model:visible="visible"
    modal
    maximizable
    :draggable="false"
    :style="{ width: 'min(72rem, 96vw)' }"
    :pt="{ content: { class: 'min-h-[min(34rem,70dvh)]' } }"
    @hide="emit('hide')"
  >
    <template #header>
      <div class="flex min-w-0 items-center gap-3">
        <span class="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[var(--p-primary-color)] text-[var(--p-primary-contrast-color)]">
          <i :class="imagesOnly ? 'pi pi-image' : 'pi pi-images'" aria-hidden="true" />
        </span>
        <div class="min-w-0">
          <div class="truncate text-lg font-semibold">{{ header }}</div>
          <div class="truncate text-xs text-[var(--p-text-muted-color)]">
            点击{{ imagesOnly ? "图片" : "文件" }}即可选择，也可以直接拖入新文件上传。
          </div>
        </div>
      </div>
    </template>
    <MediaView v-if="visible" picker :images-only="imagesOnly" @select="select" />
  </Dialog>
</template>
