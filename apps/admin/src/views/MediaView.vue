<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useConfirm } from "primevue/useconfirm";
import type { PageState } from "primevue/paginator";
import GroupedFilterSelect from "../components/GroupedFilterSelect.vue";
import ResponsiveDataTable from "../components/ResponsiveDataTable.vue";
import { PAGE_SIZE } from "../pagination";
import type { MediaAssetDto, MediaReferenceDto, Paged } from "../api/types";
import { http } from "../api/http";
import { attempt, bytesLabel, dateLabel, upload } from "../state";
const props = defineProps<{ picker?: boolean; imagesOnly?: boolean }>();
const emit = defineEmits<{ select: [asset: MediaAssetDto] }>();
const confirm = useConfirm(),
  data = ref<Paged<MediaAssetDto>>(),
  busy = ref(false),
  q = ref("");
const kindFilters = ref<string[]>([]),
  page = ref(1);
const kindGroups = computed(() => [
  {
    label: "类型",
    items: [
      { label: "图片", value: "kind:image" },
      { label: "附件", value: "kind:attachment" },
    ],
  },
]);
const kindValue = computed(
  () =>
    kindFilters.value
      .find((value) => value.startsWith("kind:"))
      ?.slice("kind:".length) ?? "",
);
const references = ref<MediaReferenceDto[]>([]),
  showReferences = ref(false),
  editing = ref<MediaAssetDto | null>(null),
  alt = ref("");
async function load(reset = false) {
  if (reset) page.value = 1;
  busy.value = true;
  await attempt(async () => {
    data.value = await http.get<Paged<MediaAssetDto>>("/api/admin/media", {
      q: q.value,
      kind: props.imagesOnly ? "image" : kindValue.value,
      page: page.value,
      pageSize: PAGE_SIZE,
    });
  });
  busy.value = false;
}
async function uploadFiles(event: { files: File | File[] }) {
  busy.value = true;
  await attempt(async () => {
    for (const file of Array.isArray(event.files) ? event.files : [event.files])
      await upload(file);
    await load(true);
  });
  busy.value = false;
}
async function copyUrl(url: string) {
  await attempt(() =>
    navigator.clipboard.writeText(new URL(url, location.origin).href),
  );
}
async function showUsage(asset: MediaAssetDto) {
  await attempt(async () => {
    references.value = await http.get<MediaReferenceDto[]>(
      `/api/admin/media/${asset.id}/references`,
    );
    showReferences.value = true;
  });
}
function remove(asset: MediaAssetDto) {
  if (asset.referenceCount) {
    void showUsage(asset);
    return;
  }
  confirm.require({
    header: "删除媒体",
    message: `永久删除 ${asset.originalFileName}？`,
    acceptLabel: "删除",
    rejectLabel: "取消",
    accept: () =>
      attempt(async () => {
        await http.del(`/api/admin/media/${asset.id}`);
        await load();
      }),
  });
}
async function saveAlt() {
  await attempt(async () => {
    await http.patch(`/api/admin/media/${editing.value!.id}`, {
      altText: alt.value,
    });
    editing.value = null;
    await load();
  });
}
function paginate(event: PageState) {
  page.value = event.page + 1;
  void load();
}
onMounted(() => load());
</script>
<template>
  <ResponsiveDataTable
    :value="data?.items ?? []"
    :loading="busy"
    empty-text="暂无媒体"
    table-style="min-width: 68rem"
    :page="page"
    :total-records="data?.totalItems ?? 0"
    @page="paginate"
  >
    <template #filters
      ><GroupedFilterSelect
        v-if="!imagesOnly"
        v-model="kindFilters"
        :groups="kindGroups"
        label="筛选媒体类型"
        placeholder="筛选"
        chip-icon="pi pi-images"
        @change="load(true)"
    /></template>
    <template #search
      ><form @submit.prevent="load(true)">
        <InputText
          v-model="q"
          placeholder="搜索文件名或替代文本"
          aria-label="搜索媒体"
        /></form
    ></template>
    <template #actions
      ><FileUpload
        mode="basic"
        custom-upload
        auto
        multiple
        :disabled="busy"
        choose-label="上传文件"
        @uploader="uploadFiles"
    /></template>
    <Column header="预览"
      ><template #body="{ data: asset }"
        ><span
          class="flex size-12 items-center justify-center overflow-hidden rounded-md bg-[var(--p-surface-100)] ring-1 ring-[var(--p-content-border-color)]"
          ><Image
            v-if="asset.kind === 'image'"
            :src="asset.thumbUrl ?? asset.url"
            :alt="asset.altText ?? ''"
            width="48"
            preview /><i v-else class="pi pi-file" /></span></template
    ></Column>
    <Column header="文件名"
      ><template #body="{ data: asset }"
        ><span class="font-medium">{{ asset.originalFileName }}</span></template
      ></Column
    >
    <Column header="类型"
      ><template #body="{ data: asset }"
        ><Tag
          :value="asset.kind === 'image' ? '图片' : '附件'"
          severity="secondary" /></template
    ></Column>
    <Column header="尺寸"
      ><template #body="{ data: asset }">{{
        asset.width ? `${asset.width} × ${asset.height}` : "—"
      }}</template></Column
    ><Column header="大小"
      ><template #body="{ data: asset }"
        ><span class="tabular-nums">{{
          bytesLabel(asset.sizeBytes)
        }}</span></template
      ></Column
    ><Column header="替代文本"
      ><template #body="{ data: asset }"
        ><span v-if="asset.altText">{{ asset.altText }}</span
        ><span v-else class="text-[var(--p-text-muted-color)]"
          >—</span
        ></template
      ></Column
    >
    <Column header="引用数"
      ><template #body="{ data: asset }"
        ><span class="font-semibold tabular-nums">{{
          asset.referenceCount
        }}</span></template
      ></Column
    >
    <Column header="上传时间"
      ><template #body="{ data: asset }"
        ><span class="text-[var(--p-text-muted-color)]">{{
          dateLabel(asset.createdAt)
        }}</span></template
      ></Column
    >
    <Column header="操作"
      ><template #body="{ data: asset }"
        ><div class="flex justify-end gap-0.5">
          <Button
            v-if="picker"
            icon="pi pi-check"
            aria-label="选择"
            title="选择"
            @click="emit('select', asset)"
          /><Button
            icon="pi pi-copy"
            text
            rounded
            aria-label="复制 URL"
            title="复制 URL"
            @click="copyUrl(asset.url)"
          /><Button
            icon="pi pi-tag"
            text
            rounded
            aria-label="替代文本"
            title="替代文本"
            @click="
              editing = asset;
              alt = asset.altText ?? '';
            "
          /><Button
            icon="pi pi-link"
            text
            rounded
            aria-label="引用"
            title="引用"
            @click="showUsage(asset)"
          /><Button
            icon="pi pi-trash"
            text
            rounded
            severity="danger"
            aria-label="删除"
            title="删除"
            @click="remove(asset)"
          /></div></template
    ></Column>
    <template #item="{ item: asset }"
      ><article class="flex items-start gap-3 p-4">
        <span
          class="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-md bg-[var(--p-surface-100)] ring-1 ring-[var(--p-content-border-color)]"
          ><Image
            v-if="asset.kind === 'image'"
            :src="asset.thumbUrl ?? asset.url"
            :alt="asset.altText ?? ''"
            width="48"
            preview /><i v-else class="pi pi-file"
        /></span>
        <div class="min-w-0 flex-1 space-y-1.5">
          <div class="flex items-start justify-between gap-2">
            <span class="min-w-0 flex-1 font-medium">{{
              asset.originalFileName
            }}</span>
            <Tag
              :value="asset.kind === 'image' ? '图片' : '附件'"
              severity="secondary"
            />
          </div>
          <p class="text-xs text-[var(--p-text-muted-color)]">
            {{ bytesLabel(asset.sizeBytes) }} ·
            {{ asset.width ? `${asset.width} × ${asset.height}` : "—" }} · 引用
            {{ asset.referenceCount }}
          </p>
          <p class="truncate text-xs text-[var(--p-text-muted-color)]">
            {{ asset.altText || "无替代文本" }}
          </p>
          <p class="text-xs text-[var(--p-text-muted-color)]">
            {{ dateLabel(asset.createdAt) }}
          </p>
          <div class="flex justify-end gap-0.5">
            <Button
              v-if="picker"
              icon="pi pi-check"
              aria-label="选择"
              title="选择"
              @click="emit('select', asset)"
            /><Button
              icon="pi pi-copy"
              text
              rounded
              aria-label="复制 URL"
              title="复制 URL"
              @click="copyUrl(asset.url)"
            /><Button
              icon="pi pi-tag"
              text
              rounded
              aria-label="替代文本"
              title="替代文本"
              @click="
                editing = asset;
                alt = asset.altText ?? '';
              "
            /><Button
              icon="pi pi-link"
              text
              rounded
              aria-label="引用"
              title="引用"
              @click="showUsage(asset)"
            /><Button
              icon="pi pi-trash"
              text
              rounded
              severity="danger"
              aria-label="删除"
              title="删除"
              @click="remove(asset)"
            />
          </div>
        </div></article
    ></template>
  </ResponsiveDataTable>
  <Dialog
    :visible="!!editing"
    modal
    header="替代文本"
    @update:visible="editing = null"
    ><Field label="替代文本"><InputText v-model="alt" /></Field
    ><Button label="保存" @click="saveAlt"
  /></Dialog>
  <Dialog v-model:visible="showReferences" modal header="媒体引用"
    ><Message v-if="references.length" severity="warn"
      >先移除以下引用才能删除；回收站文章的引用也需要清理。</Message
    ><DataTable :value="references" table-style="min-width: 32rem"
      ><template #empty>此文件未被引用</template
      ><Column field="title" header="内容" /><Column
        field="fieldKey"
        header="位置" /><Column header="在回收站中"
        ><template #body="{ data: reference }"
          ><Tag
            :value="reference.inTrash ? '是' : '否'"
            :severity="
              reference.inTrash ? 'warn' : 'secondary'
            " /></template></Column></DataTable
  ></Dialog>
</template>
