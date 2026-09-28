<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useConfirm } from "primevue/useconfirm";
import type { DataTablePageEvent } from "primevue/datatable";
import type { MediaAssetDto, MediaReferenceDto, Paged } from "../api/types";
import { http } from "../api/http";
import { attempt, bytesLabel, dateLabel, upload } from "../state";
const props = defineProps<{ picker?: boolean; imagesOnly?: boolean }>();
const emit = defineEmits<{ select: [asset: MediaAssetDto] }>();
const confirm = useConfirm(),
  data = ref<Paged<MediaAssetDto>>(),
  busy = ref(false),
  q = ref("");
const kind = ref<string | null>(props.imagesOnly ? "image" : null),
  page = ref(1),
  rows = ref(30);
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
      kind: kind.value,
      page: page.value,
      pageSize: rows.value,
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
function paginate(event: DataTablePageEvent) {
  page.value = event.page + 1;
  rows.value = event.rows;
  void load();
}
onMounted(() => load());
</script>
<template>
  <Panel header="媒体库">
    <Toolbar
      ><template #start
        ><form @submit.prevent="load(true)">
          <InputText
            v-model="q"
            placeholder="搜索文件名或替代文本"
            aria-label="搜索媒体"
          /><Select
            v-if="!imagesOnly"
            v-model="kind"
            :options="[
              { label: '图片', value: 'image' },
              { label: '附件', value: 'attachment' },
            ]"
            option-label="label"
            option-value="value"
            placeholder="全部类型"
            show-clear
          /><Button type="submit" label="搜索" /></form></template
      ><template #end
        ><FileUpload
          mode="basic"
          custom-upload
          auto
          multiple
          :disabled="busy"
          choose-label="上传文件"
          @uploader="uploadFiles" /></template
    ></Toolbar>
    <DataTable
      :value="data?.items ?? []"
      :loading="busy"
      lazy
      paginator
      :rows="rows"
      :first="(page - 1) * rows"
      :total-records="data?.totalItems ?? 0"
      @page="paginate"
    >
      <template #empty>暂无媒体</template>
      <Column header="预览"
        ><template #body="{ data: asset }"
          ><Image
            v-if="asset.kind === 'image'"
            :src="asset.thumbUrl ?? asset.url"
            :alt="asset.altText ?? ''"
            width="72"
            preview /><i v-else class="pi pi-file" /></template
      ></Column>
      <Column field="originalFileName" header="文件名" /><Column header="尺寸"
        ><template #body="{ data: asset }">{{
          asset.width ? `${asset.width} × ${asset.height}` : "—"
        }}</template></Column
      ><Column header="大小"
        ><template #body="{ data: asset }">{{
          bytesLabel(asset.sizeBytes)
        }}</template></Column
      ><Column field="altText" header="替代文本" /><Column
        field="referenceCount"
        header="引用数"
      /><Column header="上传时间"
        ><template #body="{ data: asset }">{{
          dateLabel(asset.createdAt)
        }}</template></Column
      >
      <Column header="操作"
        ><template #body="{ data: asset }"
          ><Button
            v-if="picker"
            label="选择"
            @click="emit('select', asset)" /><Button
            label="复制 URL"
            text
            @click="copyUrl(asset.url)" /><Button
            label="替代文本"
            text
            @click="
              editing = asset;
              alt = asset.altText ?? '';
            " /><Button label="引用" text @click="showUsage(asset)" /><Button
            label="删除"
            text
            severity="danger"
            @click="remove(asset)" /></template
      ></Column>
    </DataTable>
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
      ><DataTable :value="references"
        ><template #empty>此文件未被引用</template
        ><Column field="title" header="内容" /><Column
          field="fieldKey"
          header="位置" /><Column
          field="inTrash"
          header="在回收站中" /></DataTable
    ></Dialog>
  </Panel>
</template>
