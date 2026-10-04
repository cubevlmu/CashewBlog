<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import { onBeforeRouteLeave, useRoute, useRouter } from "vue-router";
import { useConfirm } from "primevue/useconfirm";
import SelectButton from "primevue/selectbutton";
import CodeEditor from "../components/CodeEditor.vue";
import { joinPageSource, splitPageSource } from "../custom-page-source";
import type { CustomPageDto, PageLayout } from "../api/types";
import { http } from "../api/http";
import { attempt } from "../state";
const route = useRoute(),
  router = useRouter(),
  confirm = useConfirm();
const id = computed(() =>
  route.params.id === "new" ? null : String(route.params.id),
);
const busy = ref(false),
  preview = ref(false),
  saved = ref("");
const layouts: { label: string; value: PageLayout }[] = [
  { label: "标准", value: "default" },
  { label: "加宽", value: "wide" },
  { label: "全宽", value: "fullWidth" },
];
const model = reactive<{ title: string; slug: string; layout: PageLayout }>({
  title: "",
  slug: "",
  layout: "default",
});
/** HTML and the page's `<style>` blocks, edited as one document. */
const source = ref("<h1>新页面</h1>");
const snapshot = () => JSON.stringify([model.title, model.layout, source.value]);
const dirty = computed(() => snapshot() !== saved.value);

function apply(page: CustomPageDto) {
  Object.assign(model, { title: page.title, slug: page.slug, layout: page.layout });
  // The server sanitizes the HTML, so reload what was actually stored.
  source.value = joinPageSource(page.contentHtml, page.customCss);
  saved.value = snapshot();
}
async function load() {
  await attempt(async () => {
    if (id.value) apply(await http.get<CustomPageDto>(`/api/admin/pages/${id.value}`));
    else saved.value = snapshot();
  });
}
async function save() {
  busy.value = true;
  await attempt(async () => {
    const body = {
      title: model.title,
      // New pages get a slug generated from the title; afterwards it stays fixed so links keep working.
      slug: id.value ? model.slug : null,
      layout: model.layout,
      ...splitPageSource(source.value),
    };
    const page = id.value
      ? await http.put<CustomPageDto>(`/api/admin/pages/${id.value}`, body)
      : await http.post<CustomPageDto>("/api/admin/pages", body);
    apply(page);
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
        saved.value = snapshot();
        await router.replace("/admin/pages");
      }),
  });
}
const previewHtml = computed(() => {
  const { contentHtml, customCss } = splitPageSource(source.value);
  return `<!doctype html><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src http: https: data:; style-src 'unsafe-inline'; font-src http: https: data:"><style>${(customCss ?? "").replace(/<\/style/gi, "")}</style>${contentHtml}`;
});
onBeforeRouteLeave(() => {
  if (!dirty.value) return true;
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
  <Toolbar class="!flex-nowrap"
    ><template #start
      ><div class="flex shrink-0 items-center gap-1">
        <Button
          icon="pi pi-arrow-left"
          text
          rounded
          severity="secondary"
          aria-label="返回页面列表"
          title="返回页面列表"
          @click="router.push('/admin/pages')" /><Button
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
      ><div class="min-w-0 flex-1">
        <InputText
          v-model="model.title"
          maxlength="200"
          placeholder="页面标题"
          aria-label="标题"
          class="w-full !border-transparent !bg-transparent !text-base !font-semibold"
      /></div
    ></template>
    <template #end
      ><div class="flex shrink-0 items-center justify-end gap-2">
        <span class="hidden text-xs text-[var(--p-text-muted-color)] sm:inline" role="status">{{
          dirty ? "有未保存的修改" : "已保存"
        }}</span>
        <Button
          v-if="id"
          icon="pi pi-trash"
          text
          rounded
          severity="danger"
          aria-label="删除页面"
          title="删除页面"
          :disabled="busy"
          @click="remove"
        />
        <Button label="保存" icon="pi pi-check" size="small" :loading="busy" @click="save" />
      </div></template
    ></Toolbar
  >
  <div class="mt-4 flex flex-col gap-4">
    <div
      class="flex flex-wrap items-center gap-x-8 gap-y-3 rounded-xl border border-[var(--p-content-border-color)] bg-[var(--p-content-background)] px-4 py-3"
    >
      <div class="flex items-center gap-3">
        <span id="page-layout-label" class="text-sm font-medium">布局</span>
        <SelectButton
          v-model="model.layout"
          :options="layouts"
          option-label="label"
          option-value="value"
          :allow-empty="false"
          aria-labelledby="page-layout-label"
        />
      </div>
      <div class="flex min-w-0 items-center gap-3 text-sm">
        <span class="shrink-0 font-medium">页面地址</span>
        <a
          v-if="id && model.slug"
          :href="`/${model.slug}/`"
          target="_blank"
          rel="noopener"
          class="flex min-w-0 items-center gap-1 font-mono text-[var(--p-primary-color)] hover:underline"
          ><span class="truncate">/{{ model.slug }}/</span><i class="pi pi-external-link shrink-0 text-xs" aria-hidden="true"
        /></a>
        <span v-else class="text-[var(--p-text-muted-color)]">保存后根据标题自动生成</span>
      </div>
    </div>
    <p class="m-0 text-sm text-[var(--p-text-muted-color)]">
      在同一文档中编写 HTML 与 <code>&lt;style&gt;</code>：样式只作用于本页面；脚本、iframe 和表单会在保存时被移除。
    </p>
    <div class="grid gap-4 lg:h-[max(28rem,calc(100dvh-22rem))]" :class="{ 'lg:grid-cols-2': preview }">
      <div class="h-[28rem] min-h-0 overflow-hidden rounded-xl border border-[var(--p-content-border-color)] lg:h-full">
        <CodeEditor v-model="source" label="页面 HTML 与 CSS" />
      </div>
      <iframe
        v-if="preview"
        title="页面预览"
        sandbox=""
        :srcdoc="previewHtml"
        class="h-[28rem] w-full rounded-xl border border-[var(--p-content-border-color)] bg-white lg:h-full"
      />
    </div>
  </div>
</template>
