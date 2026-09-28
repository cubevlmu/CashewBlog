<script setup lang="ts">
import { computed, defineAsyncComponent, ref, shallowRef } from "vue";
import { VueDraggable } from "vue-draggable-plus";
import IconPicker from "./IconPicker.vue";
import {
  choices,
  isCardCollection,
  isDateField,
  labels,
  summarizeValue,
  template,
  sidebarPages,
  type Value,
} from "./settings-fields";

const props = defineProps<{ modelValue: Value; path: string }>();
const emit = defineEmits<{ "update:modelValue": [value: Value] }>();
const key = computed(() => props.path.split(".").at(-1)!);
const MediaView = defineAsyncComponent(() => import("../views/MediaView.vue"));
const mediaVisible = ref(false);
const itemVisible = ref(false);
const selectedIndex = ref(-1);
const itemDraft = shallowRef<Value>("");
const mediaField = computed(
  () =>
    ["profile.avatar", "general.favicon", "seo.ogImage"].includes(props.path) ||
    /^banner\.(desktop|mobile)\.\d+$/.test(props.path),
);
const isImage = computed(() => mediaField.value);
const options = computed(() =>
  key.value === "type"
    ? props.path.startsWith("sidebar")
      ? ["profile", "announcement", "categories", "tags", "series", "recentPosts", "stats", "toc"]
      : ["home", "archive", "categories", "tags", "series", "rss", "page", "url"]
    : choices[key.value],
);
const entries = computed(() =>
  props.modelValue && typeof props.modelValue === "object" && !Array.isArray(props.modelValue)
    ? Object.entries(props.modelValue).filter(([name]) =>
        !(name === "id" && (props.path === "navigation" || props.path.endsWith(".children"))),
      )
    : [],
);
const collection = computed(() => Array.isArray(props.modelValue) && isCardCollection(props.path));
const languageOptions = [
  { label: "中文（简体）", value: "zh-CN", flag: "🇨🇳" },
  { label: "English", value: "en", flag: "🇺🇸" },
  { label: "Deutsch", value: "de", flag: "🇩🇪" },
  { label: "Español", value: "es", flag: "🇪🇸" },
  { label: "Français", value: "fr", flag: "🇫🇷" },
  { label: "Italiano", value: "it", flag: "🇮🇹" },
  { label: "Português", value: "pt", flag: "🇵🇹" },
  { label: "日本語", value: "ja", flag: "🇯🇵" },
  { label: "한국어", value: "ko", flag: "🇰🇷" },
  { label: "Русский", value: "ru", flag: "🇷🇺" },
];
const timezoneOptions = (Intl as typeof Intl & { supportedValuesOf?: (key: "timeZone") => string[] })
  .supportedValuesOf?.("timeZone")
  .map((value) => ({ value, label: value.replaceAll("_", " ") })) ?? [
  "Asia/Shanghai", "Asia/Tokyo", "Asia/Seoul", "Europe/London", "Europe/Paris", "America/New_York", "America/Los_Angeles", "UTC",
].map((value) => ({ value, label: value }));
const choiceLabels: Record<string, Record<string, string>> = {
  themeStyle: { tonalSpot: "柔和", vibrant: "鲜明", content: "内容自适应", expressive: "表现力", rainbow: "彩虹", fruitSalad: "缤纷", monochrome: "单色", neutral: "中性", fidelity: "忠实原色" },
  themeSpec: { "2021": "Material 3（2021）", "2025": "Material 3 Expressive（2025）" },
  defaultMode: { light: "浅色", dark: "深色", system: "跟随系统" },
  backgroundMode: { banner: "横幅背景", none: "无背景" },
  preset: { none: "无", starlight: "星光", cyberDots: "赛博圆点", topography: "等高线", geometric: "几何", sakura: "樱花" },
  topAppBarAlign: { left: "左侧", center: "居中" },
  progressIndicatorStyle: { dual: "双层", single: "单层" },
  layout: { list: "列表", grid: "网格" },
  cover: { left: "左侧", right: "右侧" },
  cardWidth: { compact: "紧凑", regular: "标准", relaxed: "宽松" },
  position: { top: "顶部", center: "居中", bottom: "底部" },
  height: { short: "较矮", default: "标准", tall: "较高" },
  animation: { kenBurns: "缓慢缩放", zoomIn: "放大", zoomOut: "缩小", panLeft: "向左平移", panRight: "向右平移", none: "无动画" },
  arrangement: { single: "单列", dual: "双列" },
  side: { left: "左侧", right: "右侧" },
  slot: { top: "顶部", sticky: "悬浮" },
  column: { primary: "主列", secondary: "次列" },
  seriesCardPosition: { top: "顶部", bottom: "底部" },
  type: { home: "首页", archive: "归档", categories: "分类", tags: "标签", series: "系列", rss: "订阅源", page: "页面", url: "自定义链接", profile: "个人资料", announcement: "公告", recentPosts: "近期文章", stats: "站点统计", toc: "文章目录" },
  target: { _blank: "新窗口打开", _self: "当前窗口打开" },
  pages: { home: "首页", archive: "归档", categories: "分类", tags: "标签", series: "系列", post: "文章", page: "独立页面", search: "搜索", rss: "订阅源", notFound: "未找到页面" },
};
const sidebarWidgetLabels: Record<string, string> = {
  profile: "个人资料",
  announcement: "公告",
  categories: "分类",
  tags: "标签",
  series: "系列",
  recentPosts: "近期文章",
  stats: "站点统计",
  toc: "文章目录",
};
const cardTitle = (item: Value, index: number) => {
  if (props.path === "sidebar.widgets" && item && typeof item === "object" && !Array.isArray(item)) {
    const type = item.type;
    return typeof type === "string" ? sidebarWidgetLabels[type] ?? "未知组件" : `组件 ${index + 1}`;
  }
  const summary = summarizeValue(item);
  return summary === "未填写" ? `项目 ${index + 1}` : summary;
};
const cardDetail = (item: Value): string => {
  if (!item || typeof item !== "object" || Array.isArray(item)) return summarizeValue(item);
  const record = item as Record<string, Value>;
  if (props.path === "sidebar.widgets") {
    const details: string[] = [];
    if (record.enable === false) details.push("已停用");
    else details.push("已启用");
    if (typeof record.column === "string") details.push(record.column === "primary" ? "主栏" : "次栏");
    if (typeof record.slot === "string") details.push(record.slot === "top" ? "顶部" : "固定区域");
    if (Array.isArray(record.pages) && record.pages.length > 0) {
      const pageNames = record.pages.map((page) => choiceLabels.pages[String(page)] ?? String(page));
      details.push(`仅显示：${pageNames.join("、")}`);
    } else details.push("全部页面");
    if (typeof record.collapseAfter === "number") details.push(`折叠 ${record.collapseAfter} 项`);
    return details.join(" · ");
  }
  if (props.path === "navigation" || props.path.endsWith(".children")) {
    const details: string[] = [];
    if (typeof record.type === "string") details.push(choiceLabels.type[record.type] ?? record.type);
    if (record.openInNewTab === true) details.push("新窗口打开");
    if (Array.isArray(record.children) && record.children.length > 0) details.push(`${record.children.length} 个子菜单`);
    return details.join(" · ") || "未填写";
  }
  return summarizeValue(item);
};
const displayChoices = computed(() =>
  (options.value ?? []).map((value) => ({ value, label: choiceLabels[key.value]?.[value] ?? value })),
);
const themeHue = computed(() => {
  const hue = (props.modelValue as Record<string, Value>)?.themeHue;
  return typeof hue === "number" ? hue : 315;
});

function updateField(name: string, value: Value) {
  emit("update:modelValue", { ...(props.modelValue as Record<string, Value>), [name]: value });
}
function updateItem(index: number, value: Value) {
  const items = [...(props.modelValue as Value[])];
  items[index] = value;
  emit("update:modelValue", items);
}
function remove(index: number) {
  const items = [...(props.modelValue as Value[])];
  items.splice(index, 1);
  emit("update:modelValue", items);
}
function editItem(index: number) {
  selectedIndex.value = index;
  itemDraft.value = JSON.parse(JSON.stringify((props.modelValue as Value[])[index])) as Value;
  itemVisible.value = true;
}
function saveItem() {
  updateItem(selectedIndex.value, itemDraft.value);
  itemVisible.value = false;
}
function formatDate(value: unknown): string | null {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) return null;
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
}
const canAdd = computed(() => key.value !== "children" || props.path.split(".").filter((k) => k === "children").length < 2);

</script>

<template>
  <MultiSelect
    v-if="key === 'pages'"
    :model-value="modelValue"
    :options="sidebarPages.map((value) => ({ value, label: choiceLabels.pages[value] ?? value }))"
    option-label="label"
    option-value="value"
    @update:model-value="emit('update:modelValue', $event)"
  />
  <template v-else-if="Array.isArray(modelValue) && collection">
    <VueDraggable
      :model-value="modelValue"
      handle=".drag-handle"
      class="flex flex-col gap-2"
      @update:model-value="emit('update:modelValue', $event)"
    >
      <Card v-for="(item, index) in modelValue" :key="index" class="settings-item-card w-full min-w-0 border border-surface-200 shadow-sm dark:border-white/20 dark:shadow-black/30">
        <template #content>
          <div class="flex min-w-0 items-center gap-2">
            <Button class="drag-handle shrink-0" icon="pi pi-arrows-v" text severity="secondary" aria-label="上下拖动排序" />
            <button class="min-w-0 flex-1 cursor-pointer border-0 bg-transparent p-0 text-left" type="button" @click="editItem(index)">
              <span class="block truncate text-sm font-medium">{{ cardTitle(item, index) }}</span>
              <span class="block truncate text-xs text-muted-color">{{ cardDetail(item) }}</span>
            </button>
            <Button icon="pi pi-pencil" text rounded severity="secondary" aria-label="编辑" @click="editItem(index)" />
            <Button icon="pi pi-trash" text rounded severity="danger" aria-label="移除" @click="remove(index)" />
          </div>
        </template>
      </Card>
    </VueDraggable>
    <Button v-if="canAdd" class="w-full justify-start" label="添加" icon="pi pi-plus" text @click="emit('update:modelValue', [...modelValue, template(path)])" />
    <Dialog v-model:visible="itemVisible" :header="selectedIndex >= 0 ? `编辑${labels[key] ?? '项目'}` : '编辑项目'" modal maximizable :style="{ width: 'min(42rem, 96vw)' }">
      <SettingsFields v-model="itemDraft" :path="`${path}.${selectedIndex}`" />
      <template #footer>
        <Button label="取消" severity="secondary" text @click="itemVisible = false" />
        <Button label="完成" icon="pi pi-check" @click="saveItem" />
      </template>
    </Dialog>
  </template>
  <template v-else-if="Array.isArray(modelValue)">
    <VueDraggable :model-value="modelValue" handle=".drag-handle" class="space-y-2" @update:model-value="emit('update:modelValue', $event)">
      <div v-for="(item, index) in modelValue" :key="index" class="rounded-lg border border-surface-200 p-3 dark:border-surface-700">
        <div class="mb-2 flex justify-end gap-1">
          <Button class="drag-handle" icon="pi pi-arrows-v" text severity="secondary" aria-label="上下拖动排序" />
          <Button icon="pi pi-trash" text severity="danger" aria-label="移除" @click="remove(index)" />
        </div>
        <SettingsFields :model-value="item" :path="`${path}.${index}`" @update:model-value="updateItem(index, $event)" />
      </div>
    </VueDraggable>
    <Button v-if="canAdd" label="添加" icon="pi pi-plus" text @click="emit('update:modelValue', [...modelValue, template(path)])" />
  </template>
  <template v-else-if="modelValue && typeof modelValue === 'object'">
    <div class="settings-object">
      <template v-for="([name, value], index) in entries" :key="name">
        <Divider v-if="index > 0 && path === 'appearance' && ['texture', 'topAppBarAlign', 'progressIndicatorStyle', 'postList'].includes(name)" class="my-4" />
        <div v-if="path === 'appearance' && ['texture', 'postList'].includes(name)" class="mb-3 text-sm font-semibold text-muted-color">{{ labels[name] }}</div>
        <template v-if="value && typeof value === 'object' && !Array.isArray(value)">
          <Divider v-if="path === 'appearance'" class="my-3" />
          <div v-if="path === 'appearance' && ['texture', 'postList'].includes(name)" class="mb-2 text-sm font-semibold text-muted-color">{{ labels[name] }}</div>
          <SettingsFields :model-value="value" :path="`${path}.${name}`" @update:model-value="updateField(name, $event)" />
        </template>
        <Field v-else :label="labels[name] ?? name">
          <SettingsFields :model-value="value" :path="`${path}.${name}`" @update:model-value="updateField(name, $event)" />
        </Field>
      </template>
      <section v-if="path === 'appearance'" class="mt-4 rounded-xl border border-surface-200 p-4 dark:border-surface-700">
        <div class="mb-3 flex items-center gap-2 text-sm font-semibold"><i class="pi pi-eye" />外观实时预览</div>
        <div class="grid grid-cols-1 gap-3">
          <div class="rounded-lg p-3" :style="{ background: `hsl(${themeHue} 70% 96%)`, color: `hsl(${themeHue} 48% 28%)` }"><div class="text-xs opacity-70">主题色</div><div class="mt-1 font-semibold">你好，世界</div><div class="mt-1 text-xs">这是页面内容与背景的预览</div></div>
          <div class="flex items-center gap-2 rounded-lg border border-surface-200 p-3 dark:border-surface-700"><span class="size-8 rounded-full" :style="{ background: `hsl(${themeHue} 65% 52%)` }" /><div><div class="text-xs text-muted-color">强调色</div><div class="text-sm font-medium">链接与图标</div></div></div>
          <div class="flex items-center gap-2 rounded-lg p-3 text-white" :style="{ background: `hsl(${themeHue} 58% 44%)` }"><i class="pi pi-check-circle" /><span class="text-sm font-medium">按钮预览</span></div>
        </div>
      </section>
    </div>
  </template>
  <div v-else-if="isImage" class="w-full rounded-xl border border-surface-200 p-3 dark:border-surface-700">
    <div class="flex flex-wrap items-center gap-3">
      <div v-if="modelValue" class="group relative size-24 shrink-0 overflow-hidden rounded-lg border border-surface-200 dark:border-surface-700">
        <img :src="String(modelValue)" alt="图片预览" class="size-full object-cover" />
        <Button icon="pi pi-times" rounded severity="danger" size="small" class="absolute right-1 top-1 opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100" aria-label="移除图片" @click="emit('update:modelValue', null)" />
      </div>
      <span v-else class="flex size-24 shrink-0 items-center justify-center rounded-lg border-2 border-dashed border-surface-300 text-muted-color dark:border-surface-600"><i class="pi pi-image text-2xl" /></span>
      <div class="min-w-0 flex-1"><div class="truncate text-sm font-medium">{{ modelValue ? String(modelValue).split('/').at(-1) : '尚未选择图片' }}</div><div class="mt-1 text-xs text-muted-color">选择一张媒体库中的图片</div><Button class="mt-2" :label="modelValue ? '更换图片' : '打开图片管理器'" icon="pi pi-images" severity="secondary" variant="outlined" size="small" @click="mediaVisible = true" /></div>
    </div>
  </div>
  <DatePicker v-else-if="isDateField(path)" :model-value="typeof modelValue === 'string' && modelValue ? new Date(`${modelValue}T00:00:00`) : null" date-format="yy-mm-dd" show-icon show-button-bar @update:model-value="emit('update:modelValue', formatDate($event))" />
  <Select v-else-if="key === 'language'" :model-value="modelValue" :options="languageOptions" option-label="label" option-value="value" filter filter-by="label" checkmark class="w-full" @update:model-value="emit('update:modelValue', $event)">
    <template #value="slotProps"><span v-if="slotProps.value" class="flex items-center gap-2"><span>{{ languageOptions.find((item) => item.value === slotProps.value)?.flag }}</span>{{ languageOptions.find((item) => item.value === slotProps.value)?.label }}</span><span v-else>{{ slotProps.placeholder }}</span></template>
    <template #option="slotProps"><span class="flex items-center gap-2"><span>{{ slotProps.option.flag }}</span>{{ slotProps.option.label }}</span></template>
  </Select>
  <Select v-else-if="key === 'timezone'" :model-value="modelValue" :options="timezoneOptions" option-label="label" option-value="value" filter filter-by="label" checkmark class="w-full" @update:model-value="emit('update:modelValue', $event)" />
  <Select v-else-if="options" :model-value="modelValue" :options="displayChoices" option-label="label" option-value="value" @update:model-value="emit('update:modelValue', $event)" />
  <ToggleSwitch v-else-if="typeof modelValue === 'boolean'" class="mt-3" :model-value="modelValue" @update:model-value="emit('update:modelValue', $event)" />
  <InputNumber v-else-if="typeof modelValue === 'number' || key === 'collapseAfter'" :model-value="modelValue as number | null" :max-fraction-digits="3" @update:model-value="emit('update:modelValue', $event)" />
  <Textarea v-else-if="['html', 'content', 'description', 'bio', 'extraRobots', 'defaultDescription'].includes(key)" :model-value="modelValue as string | null" auto-resize rows="4" @update:model-value="emit('update:modelValue', $event ?? '')" />
  <IconPicker v-else-if="key === 'icon'" :model-value="typeof modelValue === 'string' ? modelValue : ''" @update:model-value="emit('update:modelValue', $event)" />
  <InputText v-else :type="key === 'email' ? 'email' : 'text'" :model-value="modelValue as string | null" :invalid="key === 'email' && !!modelValue && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(modelValue))" class="w-full" @update:model-value="emit('update:modelValue', $event ?? '')" />
  <Dialog v-if="isImage" v-model:visible="mediaVisible" header="选择媒体" modal maximizable :style="{ width: 'min(72rem, 96vw)' }">
    <MediaView v-if="mediaVisible" picker images-only @select="emit('update:modelValue', $event.url); mediaVisible = false" />
  </Dialog>
</template>

<style scoped>
.settings-object { display: flex; flex-direction: column; gap: 0; }
.settings-object :deep(.p-divider) { margin-block: 0.75rem; }
</style>
