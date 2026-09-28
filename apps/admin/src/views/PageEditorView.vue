<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import { onBeforeRouteLeave, useRoute, useRouter } from "vue-router";
import { useConfirm } from "primevue/useconfirm";
import MediaView from "./MediaView.vue";
import type { MediaAssetDto } from "../api/types";
import CodeEditor from "../components/CodeEditor.vue";
import type { CustomPageDto, UpsertCustomPageRequest } from "../api/types";
import { http } from "../api/http";
import { attempt } from "../state";
const route = useRoute(),
  router = useRouter(),
  confirm = useConfirm();
const saved = ref(""),
  mediaVisible = ref(false);
const id = computed(() =>
  route.params.id === "new" ? null : String(route.params.id),
);
const busy = ref(false),
  preview = ref(false);
const model = reactive<UpsertCustomPageRequest>({
  title: "",
  slug: null,
  contentHtml: "<h1>新页面</h1>",
  customCss: "",
  layout: "default",
});
async function load() {
  await attempt(async () => {
    if (id.value)
      Object.assign(
        model,
        await http.get<CustomPageDto>(`/api/admin/pages/${id.value}`),
      );
    saved.value = JSON.stringify(model);
  });
}
async function save() {
  busy.value = true;
  await attempt(async () => {
    const page = id.value
      ? await http.put<CustomPageDto>(`/api/admin/pages/${id.value}`, model)
      : await http.post<CustomPageDto>("/api/admin/pages", model);
    Object.assign(model, page);
    saved.value = JSON.stringify(model);
    await router.replace(`/admin/pages/${page.id}`);
  });
  busy.value = false;
}
function remove() {
  confirm.require({
    header: "删除页面",
    message: "确定永久删除此页面？",
    acceptLabel: "删除",
    rejectLabel: "取消",
    accept: () =>
      attempt(async () => {
        await http.del(`/api/admin/pages/${id.value}`);
        saved.value = JSON.stringify(model);
        await router.replace("/admin/pages");
      }),
  });
}
const previewHtml = computed(
  () =>
    `<!doctype html><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src http: https: data:; style-src 'unsafe-inline'; font-src http: https: data:"><style>${(model.customCss ?? "").replace(/<\/style/gi, "")}</style>${model.contentHtml}`,
);
function selectMedia(asset: MediaAssetDto) {
  const url = asset.url.replaceAll('"', "&quot;");
  model.contentHtml +=
    asset.kind === "image"
      ? `\n<img src="${url}" alt="">`
      : `\n<a href="${url}">附件</a>`;
  mediaVisible.value = false;
}
onBeforeRouteLeave(() => {
  if (JSON.stringify(model) === saved.value) return true;
  return new Promise<boolean>((resolve) =>
    confirm.require({
      header: "未保存修改",
      message: "离开会丢失修改，确定继续？",
      acceptLabel: "离开",
      rejectLabel: "继续编辑",
      accept: () => resolve(true),
      reject: () => resolve(false),
      onHide: () => resolve(false),
    }),
  );
});
onMounted(load);
</script>
<template>
  <Toolbar
    ><template #start
      ><div class="flex items-center gap-1">
        <Button
          icon="pi pi-arrow-left"
          text
          rounded
          severity="secondary"
          aria-label="返回页面列表"
          title="返回页面列表"
          @click="router.push('/admin/pages')" /><Button
          icon="pi pi-image"
          text
          rounded
          severity="secondary"
          aria-label="插入媒体"
          title="插入媒体"
          @click="mediaVisible = true" /><Button
          :icon="preview ? 'pi pi-eye-slash' : 'pi pi-eye'"
          text
          rounded
          :severity="preview ? 'primary' : 'secondary'"
          :aria-label="preview ? '关闭预览' : '预览'"
          :title="preview ? '关闭预览' : '预览'"
          @click="preview = !preview"
        /></div></template
    >
    <template #center
      ><InputText
        v-model="model.title"
        maxlength="200"
        placeholder="页面标题"
        aria-label="标题"
        class="w-full !border-transparent !bg-transparent !text-base !font-semibold"
    /></template>
    <template #end
      ><div class="flex flex-wrap items-center justify-end gap-2">
        <ButtonGroup
          ><Button
            label="保存"
            icon="pi pi-check"
            size="small"
            :loading="busy"
            @click="save" /><Button
            v-if="id"
            label="删除"
            icon="pi pi-trash"
            size="small"
            severity="danger"
            :disabled="busy"
            @click="remove"
        /></ButtonGroup>
      </div></template
    ></Toolbar
  ><iframe
    v-if="preview"
    title="页面预览"
    sandbox=""
    :srcdoc="previewHtml"
    width="100%"
    height="480"
  /><Fluid v-else
    ><Field label="Slug"
      ><InputText v-model="model.slug" placeholder="留空自动生成" /></Field
    ><Field label="布局"
      ><Select
        v-model="model.layout"
        :options="['default', 'wide', 'fullWidth']" /></Field
    ><Field label="HTML"
      ><CodeEditor v-model="model.contentHtml" language="html" /></Field
    ><Field label="CSS"
      ><CodeEditor
        :model-value="model.customCss ?? ''"
        language="css"
        @update:model-value="model.customCss = $event" /></Field></Fluid
  ><Dialog v-model:visible="mediaVisible" modal maximizable header="插入媒体"
    ><MediaView v-if="mediaVisible" picker @select="selectMedia"
  /></Dialog>
</template>
