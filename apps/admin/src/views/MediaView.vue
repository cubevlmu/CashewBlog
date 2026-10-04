<script setup lang="ts">
// Media library as a thumbnail grid. In the library, a card opens a details drawer (preview,
// alt text, URLs, references, delete); in picker mode a card selects the asset.
import { computed, onMounted, ref } from "vue";
import { useConfirm } from "primevue/useconfirm";
import type { PageState } from "primevue/paginator";
import Drawer from "primevue/drawer";
import IconField from "primevue/iconfield";
import InputGroup from "primevue/inputgroup";
import InputGroupAddon from "primevue/inputgroupaddon";
import InputIcon from "primevue/inputicon";
import Skeleton from "primevue/skeleton";
import { PAGE_SIZE } from "../pagination";
import type { MediaAssetDto, MediaReferenceDto, Paged } from "../api/types";
import { http } from "../api/http";
import { attempt, bytesLabel, dateLabel, upload } from "../state";
const props = defineProps<{ picker?: boolean; imagesOnly?: boolean }>();
const emit = defineEmits<{ select: [asset: MediaAssetDto] }>();
const confirm = useConfirm(),
  data = ref<Paged<MediaAssetDto>>(),
  busy = ref(false),
  uploading = ref(0),
  dragging = ref(false),
  q = ref(""),
  kind = ref<"" | "image" | "attachment">(""),
  page = ref(1);
const fileInput = ref<HTMLInputElement>();
const kinds = [
  { label: "全部", value: "" },
  { label: "图片", value: "image" },
  { label: "附件", value: "attachment" },
];

async function load(reset = false) {
  if (reset) page.value = 1;
  busy.value = true;
  await attempt(async () => {
    data.value = await http.get<Paged<MediaAssetDto>>("/api/admin/media", {
      q: q.value,
      kind: props.imagesOnly ? "image" : kind.value,
      page: page.value,
      pageSize: PAGE_SIZE,
    });
  });
  busy.value = false;
}
async function uploadFiles(files: File[]) {
  if (!files.length) return;
  uploading.value = files.length;
  await attempt(async () => {
    for (const file of files) {
      await upload(file);
      uploading.value--;
    }
  });
  uploading.value = 0;
  await load(true);
}
function onFilesPicked() {
  void uploadFiles(Array.from(fileInput.value?.files ?? []));
  if (fileInput.value) fileInput.value.value = "";
}
function onDrop(event: DragEvent) {
  dragging.value = false;
  void uploadFiles(Array.from(event.dataTransfer?.files ?? []));
}
function onDragOver(event: DragEvent) {
  if (!event.dataTransfer?.types.includes("Files")) return;
  event.preventDefault();
  dragging.value = true;
}
function paginate(event: PageState) {
  page.value = event.page + 1;
  void load();
}

/** Short type badge for attachments, e.g. PDF or ZIP. */
function extension(asset: MediaAssetDto) {
  return asset.originalFileName.includes(".") ? asset.originalFileName.split(".").at(-1)!.toUpperCase().slice(0, 4) : "FILE";
}
function fileIcon(asset: MediaAssetDto) {
  const mime = asset.mimeType;
  if (mime.startsWith("video/")) return "pi pi-video";
  if (mime.startsWith("audio/")) return "pi pi-volume-up";
  if (mime === "application/pdf") return "pi pi-file-pdf";
  if (/zip|rar|7z|tar|gzip/.test(mime)) return "pi pi-box";
  return "pi pi-file";
}

// Details drawer ------------------------------------------------------------------------------

const selected = ref<MediaAssetDto | null>(null),
  alt = ref(""),
  references = ref<MediaReferenceDto[]>([]),
  referencesLoading = ref(false),
  copied = ref("");
const detailsVisible = computed({
  get: () => !!selected.value,
  set: (open) => {
    if (!open) selected.value = null;
  },
});
const ownerLabel: Record<MediaReferenceDto["ownerType"], string> = {
  post: "文章",
  customPage: "页面",
  siteSettings: "站点设置",
};
const fieldLabel: Record<string, string> = {
  cover: "封面",
  body: "正文",
  workingCopy: "工作副本",
  html: "HTML",
  css: "CSS",
  avatar: "头像",
  favicon: "网站图标",
  ogImage: "分享图片",
  banner: "横幅",
  bannerMobile: "手机横幅",
};
async function openDetails(asset: MediaAssetDto) {
  if (props.picker) {
    emit("select", asset);
    return;
  }
  selected.value = asset;
  alt.value = asset.altText ?? "";
  copied.value = "";
  references.value = [];
  referencesLoading.value = true;
  await attempt(async () => {
    references.value = await http.get<MediaReferenceDto[]>(`/api/admin/media/${asset.id}/references`);
  });
  referencesLoading.value = false;
}
async function saveAlt() {
  const asset = selected.value;
  if (!asset) return;
  await attempt(async () => {
    await http.patch(`/api/admin/media/${asset.id}`, { altText: alt.value });
    asset.altText = alt.value || null;
  });
}
async function copyUrl(url: string) {
  await attempt(async () => {
    await navigator.clipboard.writeText(new URL(url, location.origin).href);
    copied.value = url;
  });
}
function remove(asset: MediaAssetDto) {
  confirm.require({
    header: "删除媒体",
    message: `永久删除 ${asset.originalFileName}？此操作无法撤销。`,
    acceptLabel: "删除",
    rejectLabel: "取消",
    acceptClass: "p-button-danger",
    accept: () =>
      attempt(async () => {
        await http.del(`/api/admin/media/${asset.id}`);
        selected.value = null;
        await load();
      }),
  });
}
// Picker: the dialog focuses `[autofocus]` after its enter transition; if this view mounted
// too late for that, the dialog fell back to its maximize button, so focus again after load.
const searchInput = ref<{ $el: HTMLInputElement }>();
onMounted(async () => {
  await load();
  if (props.picker) searchInput.value?.$el.focus({ preventScroll: true });
});
</script>
<template>
  <div
    class="relative flex min-w-0 flex-col gap-4"
    @dragover="onDragOver"
    @dragleave.self="dragging = false"
    @drop.prevent="onDrop"
  >
    <div class="flex flex-wrap items-center gap-3">
      <SelectButton
        v-if="!imagesOnly"
        v-model="kind"
        :options="kinds"
        option-label="label"
        option-value="value"
        :allow-empty="false"
        aria-label="媒体类型"
        @change="load(true)"
      />
      <form class="min-w-48 flex-1" @submit.prevent="load(true)">
        <IconField>
          <InputIcon class="pi pi-search" />
          <InputText v-model="q" placeholder="搜索文件名或替代文本" aria-label="搜索媒体" class="w-full" ref="searchInput" :autofocus="picker" />
        </IconField>
      </form>
      <Button
        label="上传文件"
        icon="pi pi-upload"
        :loading="uploading > 0"
        :disabled="uploading > 0"
        @click="fileInput?.click()"
      />
      <input ref="fileInput" type="file" multiple class="hidden" :accept="imagesOnly ? 'image/*' : undefined" @change="onFilesPicked" />
    </div>

    <Message v-if="uploading" severity="info" size="small">正在上传，剩余 {{ uploading }} 个文件…</Message>

    <div
      v-if="data?.items.length"
      class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"
      :class="{ 'opacity-60': busy }"
    >
      <button
        v-for="asset in data.items"
        :key="asset.id"
        type="button"
        class="group flex min-w-0 cursor-pointer flex-col overflow-hidden rounded-xl border border-[var(--p-content-border-color)] bg-[var(--p-content-background)] p-0 text-left text-[var(--p-text-color)] transition-shadow hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--p-primary-color)]"
        :aria-label="`${picker ? '选择' : '查看'} ${asset.originalFileName}`"
        @click="openDetails(asset)"
      >
        <span class="relative flex aspect-[4/3] w-full items-center justify-center overflow-hidden bg-[var(--p-content-hover-background)]">
          <img
            v-if="asset.kind === 'image'"
            :src="asset.thumbUrl ?? asset.url"
            :alt="asset.altText ?? ''"
            loading="lazy"
            class="size-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
          <span v-else class="flex flex-col items-center gap-2 text-[var(--p-text-muted-color)]">
            <i :class="[fileIcon(asset), 'text-3xl']" aria-hidden="true" />
            <span class="rounded bg-[var(--p-content-background)] px-1.5 py-0.5 font-mono text-[0.65rem] font-semibold">{{ extension(asset) }}</span>
          </span>
          <span
            v-if="asset.referenceCount"
            class="absolute top-2 left-2 rounded-full bg-black/60 px-2 py-0.5 text-[0.7rem] font-medium text-white"
            :title="`被引用 ${asset.referenceCount} 次`"
            >{{ asset.referenceCount }} 处引用</span
          >
          <span
            v-if="picker"
            class="absolute inset-0 flex items-center justify-center bg-[var(--p-primary-color)]/0 opacity-0 transition-opacity group-hover:bg-black/35 group-hover:opacity-100"
            aria-hidden="true"
            ><span class="flex items-center gap-1 rounded-full bg-white px-3 py-1 text-sm font-medium text-black"><i class="pi pi-check text-xs" />选择</span></span
          >
        </span>
        <span class="flex min-w-0 flex-col gap-0.5 px-3 py-2">
          <span class="truncate text-sm font-medium">{{ asset.originalFileName }}</span>
          <span class="truncate text-xs text-[var(--p-text-muted-color)]">
            {{ bytesLabel(asset.sizeBytes) }}<template v-if="asset.width"> · {{ asset.width }}×{{ asset.height }}</template>
          </span>
        </span>
      </button>
    </div>
    <div
      v-else-if="!busy"
      class="flex flex-col items-center gap-3 rounded-xl border-2 border-dashed border-[var(--p-content-border-color)] px-6 py-14 text-center"
    >
      <i class="pi pi-images text-4xl text-[var(--p-text-muted-color)]" aria-hidden="true" />
      <div class="text-sm font-medium">{{ q ? "没有匹配的媒体" : "还没有媒体文件" }}</div>
      <div class="text-xs text-[var(--p-text-muted-color)]">把文件拖到这里，或点击“上传文件”。</div>
    </div>
    <div v-else class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5" aria-hidden="true">
      <Skeleton v-for="index in 10" :key="index" height="11rem" border-radius="0.75rem" />
    </div>

    <Paginator
      v-if="(data?.totalItems ?? 0) > PAGE_SIZE"
      :first="(page - 1) * PAGE_SIZE"
      :rows="PAGE_SIZE"
      :total-records="data?.totalItems ?? 0"
      template="PrevPageLink PageLinks NextPageLink"
      class="!bg-transparent"
      @page="paginate"
    />

    <div
      v-if="dragging"
      class="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-xl border-2 border-dashed border-[var(--p-primary-color)] bg-[var(--p-content-background)]/90"
    >
      <span class="flex items-center gap-2 text-sm font-medium text-[var(--p-primary-color)]"><i class="pi pi-upload" />松开鼠标上传文件</span>
    </div>
  </div>

  <Drawer v-model:visible="detailsVisible" position="right" class="!w-full sm:!w-[28rem]">
    <template #header>
      <div class="flex min-w-0 items-center gap-2">
        <i :class="selected?.kind === 'image' ? 'pi pi-image' : 'pi pi-file'" class="text-[var(--p-primary-color)]" aria-hidden="true" />
        <span class="truncate text-lg font-semibold">媒体详情</span>
      </div>
    </template>
    <div v-if="selected" class="flex flex-col gap-5">
      <div class="flex max-h-72 items-center justify-center overflow-hidden rounded-xl border border-[var(--p-content-border-color)] bg-[var(--p-content-hover-background)]">
        <img v-if="selected.kind === 'image'" :src="selected.displayUrl ?? selected.url" :alt="selected.altText ?? ''" class="max-h-72 max-w-full object-contain" />
        <span v-else class="flex flex-col items-center gap-2 py-10 text-[var(--p-text-muted-color)]">
          <i :class="[fileIcon(selected), 'text-5xl']" aria-hidden="true" />
          <span class="font-mono text-xs font-semibold">{{ extension(selected) }}</span>
        </span>
      </div>

      <div>
        <div class="break-all text-base font-semibold">{{ selected.originalFileName }}</div>
        <dl class="m-0 mt-3 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
          <div>
            <dt class="text-xs text-[var(--p-text-muted-color)]">类型</dt>
            <dd class="m-0 break-all">{{ selected.mimeType }}</dd>
          </div>
          <div>
            <dt class="text-xs text-[var(--p-text-muted-color)]">大小</dt>
            <dd class="m-0 tabular-nums">{{ bytesLabel(selected.sizeBytes) }}</dd>
          </div>
          <div v-if="selected.width">
            <dt class="text-xs text-[var(--p-text-muted-color)]">尺寸</dt>
            <dd class="m-0 tabular-nums">{{ selected.width }} × {{ selected.height }}</dd>
          </div>
          <div>
            <dt class="text-xs text-[var(--p-text-muted-color)]">上传时间</dt>
            <dd class="m-0">{{ dateLabel(selected.createdAt) }}</dd>
          </div>
        </dl>
      </div>

      <form v-if="selected.kind === 'image'" class="flex flex-col gap-1.5" @submit.prevent="saveAlt">
        <label for="media-alt" class="text-sm font-medium">替代文本</label>
        <InputGroup>
          <InputText id="media-alt" v-model="alt" placeholder="描述图片内容，便于无障碍阅读" />
          <Button type="submit" icon="pi pi-check" aria-label="保存替代文本" title="保存替代文本" :disabled="alt === (selected.altText ?? '')" />
        </InputGroup>
        <small class="text-[var(--p-text-muted-color)]">插入文章时作为图片的默认说明。</small>
      </form>

      <div class="flex flex-col gap-2">
        <span class="text-sm font-medium">链接</span>
        <InputGroup v-for="link in selected.kind === 'image' ? [{ label: '展示图', url: selected.url }, { label: '原图', url: selected.originalUrl }] : [{ label: '文件', url: selected.url }]" :key="link.label">
          <InputGroupAddon class="!min-w-16 text-xs">{{ link.label }}</InputGroupAddon>
          <InputText :model-value="link.url" readonly :aria-label="`${link.label}地址`" class="font-mono !text-xs" />
          <Button
            :icon="copied === link.url ? 'pi pi-check' : 'pi pi-copy'"
            severity="secondary"
            :aria-label="`复制${link.label}地址`"
            :title="copied === link.url ? '已复制' : '复制地址'"
            @click="copyUrl(link.url)"
          />
        </InputGroup>
      </div>

      <div class="flex flex-col gap-2">
        <span class="text-sm font-medium">引用</span>
        <div v-if="referencesLoading" class="text-sm text-[var(--p-text-muted-color)]"><i class="pi pi-spin pi-spinner mr-1" />正在加载…</div>
        <p v-else-if="!references.length" class="m-0 rounded-lg border border-dashed border-[var(--p-content-border-color)] px-3 py-3 text-sm text-[var(--p-text-muted-color)]">
          没有内容引用此文件，可以安全删除。
        </p>
        <ul v-else class="m-0 flex list-none flex-col divide-y divide-[var(--p-content-border-color)] rounded-lg border border-[var(--p-content-border-color)] p-0">
          <li v-for="(reference, index) in references" :key="index" class="flex items-center justify-between gap-3 px-3 py-2 text-sm">
            <div class="min-w-0">
              <div class="truncate font-medium">{{ reference.title }}</div>
              <div class="text-xs text-[var(--p-text-muted-color)]">
                {{ ownerLabel[reference.ownerType] }} · {{ fieldLabel[reference.fieldKey] ?? reference.fieldKey }}
              </div>
            </div>
            <Tag v-if="reference.inTrash" value="回收站" severity="warn" />
          </li>
        </ul>
      </div>
    </div>
    <template #footer>
      <div v-if="selected" class="flex flex-col gap-2">
        <Message v-if="references.length" severity="warn" size="small">
          仍被 {{ references.length }} 处内容引用，移除引用后才能删除（回收站中的文章也算）。
        </Message>
        <div class="flex gap-2">
          <Button as="a" :href="selected.url" target="_blank" rel="noopener" label="打开" icon="pi pi-external-link" severity="secondary" outlined class="flex-1" />
          <Button label="删除" icon="pi pi-trash" severity="danger" outlined class="flex-1" :disabled="referencesLoading || references.length > 0" @click="remove(selected)" />
        </div>
      </div>
    </template>
  </Drawer>
</template>
