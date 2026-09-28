<script setup lang="ts">
import { onMounted, onBeforeUnmount, reactive, ref, computed } from "vue";
import { onBeforeRouteLeave, useRoute, useRouter } from "vue-router";
import { useConfirm } from "primevue/useconfirm";
import MarkdownEditor from "../components/MarkdownEditor.vue";
import MediaView from "./MediaView.vue";
import type {
  AdminPostDto,
  UpsertPostRequest,
  AdminCategoryDto,
  AdminTagDto,
  AdminSeriesDto,
  MediaAssetDto,
} from "../api/types";
import { http, request } from "../api/http";
import { attempt, statusLabel, failure, errorMessage } from "../state";
const route = useRoute(),
  router = useRouter(),
  confirm = useConfirm();
const id = ref(route.params.id === "new" ? null : String(route.params.id));
const post = ref<AdminPostDto>(),
  busy = ref(false),
  ready = ref(false),
  autosaveState = ref("未保存");
const categories = ref<AdminCategoryDto[]>([]),
  tags = ref<string[]>([]),
  series = ref<AdminSeriesDto[]>([]);
const model = reactive<UpsertPostRequest>({
  title: "",
  slug: "",
  description: "",
  contentMarkdown: "",
  coverMediaId: null,
  categoryId: null,
  seriesId: null,
  seriesOrder: null,
  tags: [],
  isPinned: false,
  seoTitle: "",
  seoDescription: "",
});
const editor = ref<InstanceType<typeof MarkdownEditor>>(),
  mode = ref("visual"),
  mediaVisible = ref(false),
  coverMode = ref(false),
  coverUrl = ref(""),
  tagInput = ref("");
const savedBody = ref(""),
  savedContent = ref(""),
  savedTitle = ref("");
const dirty = computed(
  () => ready.value && JSON.stringify(model) !== savedBody.value,
);
const contentDirty = computed(
  () =>
    model.contentMarkdown !== savedContent.value ||
    (post.value?.status === "draft" && model.title !== savedTitle.value),
);
let timer: ReturnType<typeof setInterval> | undefined,
  saving: Promise<void> | null = null,
  allowLeave = false;
function applyDto(dto: AdminPostDto) {
  post.value = dto;
  autosaveState.value = dto.hasWorkingCopy
    ? "已恢复自动保存的工作副本"
    : "已保存";
  Object.assign(model, {
    title: dto.title,
    slug: dto.slug,
    description: dto.description,
    contentMarkdown: dto.editingContentMarkdown ?? dto.contentMarkdown,
    coverMediaId: dto.coverMediaId,
    categoryId: dto.categoryId,
    seriesId: dto.seriesId,
    seriesOrder: dto.seriesOrder,
    tags: dto.tags.map((t) => t.name),
    isPinned: dto.isPinned,
    seoTitle: dto.seoTitle,
    seoDescription: dto.seoDescription,
  });
  coverUrl.value = dto.cover?.url ?? "";
  savedBody.value = JSON.stringify(model);
  savedContent.value = model.contentMarkdown;
  savedTitle.value = model.title;
}
async function save(action?: "publish" | "private" | "draft") {
  if (busy.value) return;
  busy.value = true;
  await attempt(async () => {
    await saving;
    const body = JSON.parse(JSON.stringify(model)) as UpsertPostRequest;
    let dto: AdminPostDto;
    if (!id.value) {
      dto = await http.post<AdminPostDto>("/api/admin/posts", body);
      id.value = dto.id;
      post.value = dto;
      if (action)
        dto = await http.post<AdminPostDto>(
          `/api/admin/posts/${id.value}/${action}`,
          body,
        );
    } else
      dto = action
        ? await http.post<AdminPostDto>(
            `/api/admin/posts/${id.value}/${action}`,
            body,
          )
        : await http.put<AdminPostDto>(`/api/admin/posts/${id.value}`, body);
    applyDto(dto);
    autosaveState.value = "已保存";
    if (route.params.id === "new") {
      allowLeave = true;
      await router.replace(`/admin/posts/${dto.id}`);
    }
  });
  busy.value = false;
}
async function autosave(keepalive = false) {
  if (!id.value || !contentDirty.value || busy.value) return;
  if (saving) return saving;
  const body = { contentMarkdown: model.contentMarkdown, title: model.title };
  autosaveState.value = "自动保存中…";
  saving = (async () => {
    try {
      await request("POST", `/api/admin/posts/${id.value}/autosave`, {
        body,
        keepalive,
      });
      savedContent.value = body.contentMarkdown;
      savedTitle.value = body.title;
      autosaveState.value = "正文已自动保存；元数据需点击保存";
    } catch (error) {
      autosaveState.value = "自动保存失败";
      failure.value = errorMessage(error);
    } finally {
      saving = null;
    }
  })();
  return saving;
}
async function preview() {
  if (!id.value) {
    failure.value = "请先保存草稿后预览";
    return;
  }
  const target = window.open("about:blank", "_blank");
  if (target) target.opener = null;
  await autosave();
  if (contentDirty.value) {
    target?.close();
    return;
  }
  if (target)
    target.location.href = `/posts/${encodeURIComponent(post.value!.slug)}?preview=true`;
}
function addTag() {
  const name = tagInput.value.trim();
  if (name && !model.tags!.includes(name)) model.tags!.push(name);
  if (name && !tags.value.includes(name)) tags.value.push(name);
  tagInput.value = "";
}
function selectMedia(asset: MediaAssetDto) {
  if (coverMode.value) {
    model.coverMediaId = asset.id;
    coverUrl.value = asset.url;
  } else {
    const name = (asset.altText ?? asset.originalFileName).replace(
      /[\[\]\\]/g,
      "",
    );
    const text =
      asset.kind === "image"
        ? `![${name}](${asset.url})`
        : `[${name}](${asset.url})`;
    if (mode.value === "visual") editor.value?.insert(text);
    else model.contentMarkdown += `\n${text}\n`;
  }
  mediaVisible.value = false;
}
function beforeUnload(event: BeforeUnloadEvent) {
  if (dirty.value) {
    void autosave(true);
    event.preventDefault();
    event.returnValue = "";
  }
}
function blur() {
  void autosave(true);
}
onBeforeRouteLeave(async () => {
  if (allowLeave || !dirty.value) return true;
  await autosave();
  return new Promise<boolean>((resolve) =>
    confirm.require({
      header: "离开编辑器",
      message: "正文已尝试自动保存。尚未明确保存的元数据会丢失，确定离开？",
      acceptLabel: "离开",
      rejectLabel: "继续编辑",
      accept: () => resolve(true),
      reject: () => resolve(false),
      onHide: () => resolve(false),
    }),
  );
});
onMounted(async () => {
  await attempt(async () => {
    const [cats, tagList, seriesList] = await Promise.all([
      http.get<AdminCategoryDto[]>("/api/admin/categories"),
      http.get<AdminTagDto[]>("/api/admin/tags"),
      http.get<AdminSeriesDto[]>("/api/admin/series"),
    ]);
    categories.value = cats;
    tags.value = tagList.map((t) => t.name);
    series.value = seriesList;
    if (id.value)
      applyDto(await http.get<AdminPostDto>(`/api/admin/posts/${id.value}`));
    else savedBody.value = JSON.stringify(model);
    ready.value = true;
  });
  timer = setInterval(() => void autosave(), 30000);
  window.addEventListener("beforeunload", beforeUnload);
  window.addEventListener("blur", blur);
});
onBeforeUnmount(() => {
  clearInterval(timer);
  window.removeEventListener("beforeunload", beforeUnload);
  window.removeEventListener("blur", blur);
});
</script>
<template>
  <Toolbar
    ><template #start
      ><Button label="返回文章" text @click="router.push('/admin/posts')" /><Tag
        :value="post ? statusLabel(post.status) : '新草稿'"
      /><span role="status">{{ autosaveState }}</span></template
    ><template #end
      ><Button
        label="预览"
        :disabled="!id"
        severity="secondary"
        @click="preview" /><Button
        label="保存"
        :loading="busy"
        @click="save()" /><Button
        label="发布"
        :disabled="busy"
        severity="success"
        @click="save('publish')" /><Button
        label="设为私密"
        :disabled="busy"
        severity="warn"
        @click="save('private')" /><Button
        v-if="post && post.status !== 'draft'"
        label="转为草稿"
        :disabled="busy"
        severity="secondary"
        @click="save('draft')" /></template
  ></Toolbar>
  <Fluid v-if="ready"
    ><Splitter
      ><SplitterPanel :size="72" :min-size="40"
        ><Field label="标题"
          ><InputText v-model="model.title" maxlength="200"
        /></Field>
        <Toolbar
          ><template #start
            ><SelectButton
              v-model="mode"
              :allow-empty="false"
              :options="[
                { label: '可视化', value: 'visual' },
                { label: 'Markdown', value: 'source' },
              ]"
              option-label="label"
              option-value="value" /></template
          ><template #end
            ><Button
              label="插入媒体"
              icon="pi pi-image"
              @click="
                coverMode = false;
                mediaVisible = true;
              " /></template
        ></Toolbar>
        <MarkdownEditor
          v-if="mode === 'visual'"
          ref="editor"
          v-model="model.contentMarkdown"
          @error="failure = $event"
        /><Textarea
          v-else
          v-model="model.contentMarkdown"
          rows="18"
          auto-resize
          aria-label="Markdown 正文"
        /> </SplitterPanel
      ><SplitterPanel :size="28" :min-size="20"
        ><Fieldset legend="文章设置" toggleable>
          <Field label="封面"
            ><Image
              v-if="coverUrl"
              :src="coverUrl"
              width="160"
              alt="封面" /><Button
              label="选择封面"
              @click="
                coverMode = true;
                mediaVisible = true;
              " /><Button
              label="清除封面"
              severity="secondary"
              @click="
                model.coverMediaId = null;
                coverUrl = '';
              "
          /></Field>
          <Field label="Slug"><InputText v-model="model.slug" /></Field
          ><Field label="摘要"
            ><Textarea v-model="model.description" auto-resize /></Field
          ><Field label="分类"
            ><Select
              v-model="model.categoryId"
              :options="categories"
              option-label="name"
              option-value="id"
              show-clear
          /></Field>
          <Field label="标签"
            ><MultiSelect
              v-model="model.tags"
              :options="tags"
              filter /><InputText
              v-model="tagInput"
              placeholder="输入新标签"
              @keydown.enter.prevent="addTag" /><Button
              label="添加标签"
              @click="addTag"
          /></Field>
          <Field label="系列"
            ><Select
              v-model="model.seriesId"
              :options="series"
              option-label="title"
              option-value="id"
              show-clear /></Field
          ><Field label="系列内顺序"
            ><InputNumber v-model="model.seriesOrder" :min="1" /></Field
          ><Field label="置顶"><ToggleSwitch v-model="model.isPinned" /></Field>
          <Field label="SEO 标题"
            ><InputText v-model="model.seoTitle" maxlength="200" /></Field
          ><Field label="SEO 描述"
            ><Textarea
              v-model="model.seoDescription"
              maxlength="500"
              auto-resize
          /></Field> </Fieldset></SplitterPanel
    ></Splitter>
  </Fluid>
  <Dialog v-model:visible="mediaVisible" modal maximizable header="选择媒体"
    ><MediaView
      v-if="mediaVisible"
      picker
      :images-only="coverMode"
      @select="selectMedia"
  /></Dialog>
</template>
