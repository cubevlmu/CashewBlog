<script setup lang="ts">
import { computed, ref, shallowRef } from "vue";
import AutoComplete from "primevue/autocomplete";
import SelectButton from "primevue/selectbutton";
import Slider from "primevue/slider";
import { VueDraggable } from "vue-draggable-plus";
import IconPicker from "./IconPicker.vue";
import MediaPickerDialog from "./MediaPickerDialog.vue";
import SettingsGroup from "./SettingsGroup.vue";
import ThemeHueField from "./ThemeHueField.vue";
import ThemeStyleSelect from "./ThemeStyleSelect.vue";
import {
  choices,
  fieldLabels,
  groupFields,
  hints,
  isCardCollection,
  isChipList,
  isDateField,
  isWideField,
  labels,
  normalizePath,
  ranges,
  summarizeValue,
  template,
  sidebarPages,
  type FieldGroup,
  type Value,
} from "./settings-fields";
import type { ThemeSpec, ThemeStyle } from "../theme-colors";

const props = withDefaults(
  defineProps<{
    modelValue: Value;
    path: string;
    /** Fields rendered elsewhere, e.g. an `enable` shown in the group header. */
    hidden?: string[];
    /** Rendered inside a group of a section's root, so no panels of its own. */
    embedded?: boolean;
    inputId?: string;
  }>(),
  { hidden: () => [], embedded: false, inputId: undefined },
);
const emit = defineEmits<{ "update:modelValue": [value: Value] }>();
const key = computed(() => props.path.split(".").at(-1)!);
const pattern = computed(() => normalizePath(props.path));
const root = computed(() => !props.path.includes(".") && !props.embedded);
const mediaVisible = ref(false);
const itemVisible = ref(false);
const selectedIndex = ref(-1);
const itemDraft = shallowRef<Value>("");

const isImage = computed(
  () =>
    ["profile.avatar", "general.favicon", "seo.ogImage"].includes(props.path) ||
    /^banner\.(desktop|mobile)\.\d+$/.test(props.path),
);
const imageCollection = computed(() => /^banner\.(desktop|mobile)$/.test(props.path));
const range = computed(() => ranges[pattern.value]);
const options = computed(() =>
  key.value === "type"
    ? props.path.startsWith("sidebar")
      ? ["profile", "announcement", "categories", "tags", "series", "recentPosts", "stats", "toc"]
      : ["home", "archive", "categories", "tags", "series", "rss", "page", "url"]
    : choices[key.value],
);
const record = computed(() =>
  props.modelValue && typeof props.modelValue === "object" && !Array.isArray(props.modelValue)
    ? (props.modelValue as Record<string, Value>)
    : null,
);
const groups = computed(() => (record.value ? groupFields(props.path, record.value, props.hidden) : []));
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
  if (imageCollection.value && typeof item === "string") return item ? item.split("/").at(-1)! : `图片 ${index + 1}`;
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

function fieldId(name: string) {
  return `setting-${props.path}.${name}`.replace(/[^\w-]/g, "-");
}
function hintFor(name: string) {
  return hints[normalizePath(`${props.path}.${name}`)];
}
function labelFor(name: string) {
  return fieldLabels[normalizePath(`${props.path}.${name}`)] ?? labels[name] ?? name;
}
/** A group holding just one list or object already shows that field's name as its title. */
function showsLabel(group: FieldGroup, name: string) {
  return !(group.fields.length === 1 && group.title === (labels[name] ?? name) && Array.isArray(record.value?.[name]));
}
function updateField(name: string, value: Value) {
  emit("update:modelValue", { ...(props.modelValue as Record<string, Value>), [name]: value });
}
function setEnable(name: string, value: boolean) {
  const child = record.value?.[name] as Record<string, Value>;
  updateField(name, { ...child, enable: value });
}
function groupEnabled(group: FieldGroup) {
  return group.object ? (record.value?.[group.object] as Record<string, Value>)?.enable !== false : true;
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
function add() {
  if (imageCollection.value) {
    mediaVisible.value = true;
    return;
  }
  emit("update:modelValue", [...(props.modelValue as Value[]), template(props.path)]);
}
function onMediaSelect(url: string) {
  mediaVisible.value = false;
  if (imageCollection.value) emit("update:modelValue", [...(props.modelValue as Value[]), url]);
  else emit("update:modelValue", url);
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
const sliderValue = computed(() => (typeof props.modelValue === "number" ? props.modelValue : range.value?.min ?? 0));
</script>

<template>
  <!-- Objects: titled groups with a two-column field grid -->
  <div v-if="record" class="flex min-w-0 flex-col gap-5">
    <SettingsGroup
      v-for="group in groups"
      :key="group.id"
      :title="group.title"
      :hint="group.hint"
      :root="root"
      :toggle="group.toggle && group.object ? groupEnabled(group) : undefined"
      @toggle="group.object && setEnable(group.object, $event)"
    >
      <div v-if="group.object" :class="{ 'opacity-60': !groupEnabled(group) }">
        <SettingsFields
          :model-value="record[group.object]"
          :path="`${path}.${group.object}`"
          :hidden="group.toggle ? ['enable'] : []"
          @update:model-value="updateField(group.object, $event)"
        />
      </div>
      <div v-else class="grid grid-cols-1 gap-x-8 gap-y-5 md:grid-cols-2">
        <template v-for="name in group.fields" :key="name">
          <div
            v-if="typeof record[name] === 'boolean'"
            class="flex min-w-0 items-center justify-between gap-4 rounded-lg border border-[var(--p-content-border-color)] px-4 py-3"
          >
            <div class="min-w-0">
              <label :for="fieldId(name)" class="text-sm font-medium">{{ labelFor(name) }}</label>
              <p v-if="hintFor(name)" class="m-0 mt-0.5 text-xs text-[var(--p-text-muted-color)]">{{ hintFor(name) }}</p>
            </div>
            <ToggleSwitch
              :input-id="fieldId(name)"
              :model-value="record[name] as boolean"
              class="shrink-0"
              @update:model-value="updateField(name, $event)"
            />
          </div>
          <div
            v-else
            class="flex min-w-0 flex-col gap-1.5"
            :class="{ 'md:col-span-2': isWideField(`${path}.${name}`) || Array.isArray(record[name]) }"
          >
            <label v-if="showsLabel(group, name)" :for="fieldId(name)" class="text-sm font-medium">{{ labelFor(name) }}</label>
            <ThemeHueField
              v-if="path === 'appearance' && name === 'themeHue'"
              :model-value="record.themeHue as number"
              :theme-style="record.themeStyle as ThemeStyle"
              :theme-spec="record.themeSpec as ThemeSpec"
              @update:model-value="updateField(name, $event)"
            />
            <ThemeStyleSelect
              v-else-if="path === 'appearance' && name === 'themeStyle'"
              :model-value="record.themeStyle as ThemeStyle"
              :hue="record.themeHue as number"
              :theme-spec="record.themeSpec as ThemeSpec"
              :labels="choiceLabels.themeStyle"
              @update:model-value="updateField(name, $event)"
            />
            <SettingsFields
              v-else
              :model-value="record[name]"
              :path="`${path}.${name}`"
              :input-id="fieldId(name)"
              embedded
              @update:model-value="updateField(name, $event)"
            />
            <small v-if="hintFor(name) && showsLabel(group, name)" class="text-[var(--p-text-muted-color)]">{{ hintFor(name) }}</small>
          </div>
        </template>
      </div>
    </SettingsGroup>
  </div>

  <!-- A section whose root is a list (navigation) -->
  <SettingsGroup v-else-if="root && Array.isArray(modelValue)" :title="fieldLabels[path] ?? labels[path] ?? path" :hint="hints[path]" root>
    <SettingsFields :model-value="modelValue" :path="path" embedded @update:model-value="emit('update:modelValue', $event)" />
  </SettingsGroup>

  <MultiSelect
    v-else-if="key === 'pages'"
    :model-value="modelValue"
    :input-id="inputId"
    :options="sidebarPages.map((value) => ({ value, label: choiceLabels.pages[value] ?? value }))"
    option-label="label"
    option-value="value"
    display="chip"
    placeholder="所有页面"
    @update:model-value="emit('update:modelValue', $event)"
  />
  <AutoComplete
    v-else-if="isChipList(path)"
    :model-value="modelValue as string[]"
    :input-id="inputId"
    multiple
    :typeahead="false"
    fluid
    placeholder="输入后按回车添加"
    @update:model-value="emit('update:modelValue', $event)"
  />

  <!-- Card collections: sortable rows edited in a dialog -->
  <div v-else-if="Array.isArray(modelValue) && collection" class="flex min-w-0 flex-col gap-2">
    <VueDraggable
      v-if="modelValue.length"
      :model-value="modelValue"
      handle=".drag-handle"
      class="divide-y divide-[var(--p-content-border-color)] overflow-hidden rounded-lg border border-[var(--p-content-border-color)]"
      @update:model-value="emit('update:modelValue', $event)"
    >
      <div v-for="(item, index) in modelValue" :key="index" class="flex min-w-0 items-center gap-2 bg-[var(--p-content-background)] px-2 py-2">
        <Button class="drag-handle shrink-0 cursor-grab" icon="pi pi-bars" text severity="secondary" aria-label="拖动排序" title="拖动排序" />
        <img
          v-if="imageCollection && typeof item === 'string' && item"
          :src="item"
          alt=""
          class="h-10 w-16 shrink-0 rounded object-cover"
        />
        <button class="min-w-0 flex-1 cursor-pointer border-0 bg-transparent p-0 text-left text-[var(--p-text-color)]" type="button" @click="imageCollection ? undefined : editItem(index)">
          <span class="block truncate text-sm font-medium">{{ cardTitle(item, index) }}</span>
          <span v-if="!imageCollection" class="block truncate text-xs text-[var(--p-text-muted-color)]">{{ cardDetail(item) }}</span>
        </button>
        <Button v-if="!imageCollection" icon="pi pi-pencil" text rounded severity="secondary" aria-label="编辑" title="编辑" @click="editItem(index)" />
        <Button icon="pi pi-trash" text rounded severity="danger" aria-label="移除" title="移除" @click="remove(index)" />
      </div>
    </VueDraggable>
    <p v-else class="m-0 rounded-lg border border-dashed border-[var(--p-content-border-color)] px-4 py-5 text-center text-sm text-[var(--p-text-muted-color)]">
      暂无{{ labels[key] ?? "项目" }}
    </p>
    <Button
      v-if="canAdd"
      class="self-start" :fluid="false"
      :label="imageCollection ? '从媒体库添加' : '添加'"
      :icon="imageCollection ? 'pi pi-images' : 'pi pi-plus'"
      size="small"
      outlined
      @click="add"
    />
    <Dialog
      v-model:visible="itemVisible"
      :header="`编辑${labels[key] ?? '项目'}`"
      modal
      maximizable
      :draggable="false"
      :style="{ width: 'min(42rem, 96vw)' }"
    >
      <SettingsFields v-model="itemDraft" :path="`${path}.${selectedIndex}`" />
      <template #footer>
        <Button label="取消" severity="secondary" text @click="itemVisible = false" />
        <Button label="完成" icon="pi pi-check" @click="saveItem" />
      </template>
    </Dialog>
  </div>

  <!-- Plain lists (e.g. subtitles): one input per row -->
  <div v-else-if="Array.isArray(modelValue)" class="flex min-w-0 flex-col gap-2">
    <VueDraggable :model-value="modelValue" handle=".drag-handle" class="flex flex-col gap-2" @update:model-value="emit('update:modelValue', $event)">
      <div v-for="(item, index) in modelValue" :key="index" class="flex min-w-0 items-center gap-2">
        <Button class="drag-handle shrink-0 cursor-grab" icon="pi pi-bars" text severity="secondary" aria-label="拖动排序" title="拖动排序" />
        <div class="min-w-0 flex-1">
          <SettingsFields :model-value="item" :path="`${path}.${index}`" @update:model-value="updateItem(index, $event)" />
        </div>
        <Button icon="pi pi-trash" text rounded severity="danger" aria-label="移除" title="移除" @click="remove(index)" />
      </div>
    </VueDraggable>
    <Button v-if="canAdd" class="self-start" :fluid="false" label="添加" icon="pi pi-plus" size="small" outlined @click="add" />
  </div>

  <div v-else-if="isImage" class="flex min-w-0 flex-wrap items-center gap-4 rounded-lg border border-[var(--p-content-border-color)] p-3">
    <div v-if="modelValue" class="relative size-20 shrink-0 overflow-hidden rounded-lg border border-[var(--p-content-border-color)] bg-[var(--p-content-hover-background)]">
      <img :src="String(modelValue)" alt="图片预览" class="size-full object-cover" />
    </div>
    <span v-else class="flex size-20 shrink-0 items-center justify-center rounded-lg border-2 border-dashed border-[var(--p-content-border-color)] text-[var(--p-text-muted-color)]"><i class="pi pi-image text-2xl" /></span>
    <div class="min-w-0 flex-1">
      <div class="truncate text-sm font-medium">{{ modelValue ? String(modelValue).split("/").at(-1) : "尚未选择图片" }}</div>
      <div class="mt-2 flex flex-wrap gap-2">
        <Button :label="modelValue ? '更换图片' : '选择图片'" icon="pi pi-images" severity="secondary" outlined size="small" :fluid="false" @click="mediaVisible = true" />
        <Button v-if="modelValue" label="移除" icon="pi pi-times" severity="danger" text size="small" :fluid="false" @click="emit('update:modelValue', null)" />
      </div>
    </div>
  </div>
  <DatePicker v-else-if="isDateField(path)" :input-id="inputId" :model-value="typeof modelValue === 'string' && modelValue ? new Date(`${modelValue}T00:00:00`) : null" date-format="yy-mm-dd" show-icon show-button-bar @update:model-value="emit('update:modelValue', formatDate($event))" />
  <Select v-else-if="key === 'language'" :input-id="inputId" :model-value="modelValue" :options="languageOptions" option-label="label" option-value="value" filter filter-by="label" checkmark class="w-full" @update:model-value="emit('update:modelValue', $event)">
    <template #value="slotProps"><span v-if="slotProps.value" class="flex items-center gap-2"><span>{{ languageOptions.find((item) => item.value === slotProps.value)?.flag }}</span>{{ languageOptions.find((item) => item.value === slotProps.value)?.label }}</span><span v-else>{{ slotProps.placeholder }}</span></template>
    <template #option="slotProps"><span class="flex items-center gap-2"><span>{{ slotProps.option.flag }}</span>{{ slotProps.option.label }}</span></template>
  </Select>
  <Select v-else-if="key === 'timezone'" :input-id="inputId" :model-value="modelValue" :options="timezoneOptions" option-label="label" option-value="value" filter filter-by="label" checkmark class="w-full" @update:model-value="emit('update:modelValue', $event)" />
  <SelectButton
    v-else-if="options && displayChoices.length <= 3"
    :model-value="modelValue"
    :options="displayChoices"
    option-label="label"
    option-value="value"
    :allow-empty="false"
    :aria-labelledby="inputId"
    class="flex-wrap"
    @update:model-value="emit('update:modelValue', $event)"
  />
  <Select v-else-if="options" :input-id="inputId" :model-value="modelValue" :options="displayChoices" option-label="label" option-value="value" @update:model-value="emit('update:modelValue', $event)" />
  <ToggleSwitch v-else-if="typeof modelValue === 'boolean'" :input-id="inputId" :model-value="modelValue" @update:model-value="emit('update:modelValue', $event)" />
  <div v-else-if="range?.slider" class="flex items-center gap-4 pt-1">
    <Slider
      :model-value="sliderValue"
      :min="range.min"
      :max="range.max"
      :step="range.step"
      class="min-w-0 flex-1"
      :aria-label="labels[key] ?? key"
      @update:model-value="emit('update:modelValue', Array.isArray($event) ? $event[0] : $event)"
    />
    <span class="w-12 shrink-0 text-right font-mono text-sm tabular-nums">{{ range.percent ? `${Math.round(sliderValue * 100)}%` : sliderValue }}</span>
  </div>
  <InputNumber
    v-else-if="typeof modelValue === 'number' || key === 'collapseAfter'"
    :input-id="inputId"
    :model-value="modelValue as number | null"
    :min="range?.min"
    :max="range?.max"
    :step="range?.step ?? 1"
    :suffix="range?.suffix"
    :show-buttons="!!range"
    :max-fraction-digits="3"
    :placeholder="key === 'collapseAfter' ? '不折叠' : undefined"
    @update:model-value="emit('update:modelValue', $event)"
  />
  <Textarea v-else-if="['html', 'content', 'description', 'bio', 'extraRobots', 'defaultDescription'].includes(key)" :id="inputId" :model-value="modelValue as string | null" auto-resize :rows="key === 'html' || key === 'extraRobots' ? 6 : 3" :class="{ 'font-mono text-sm': key === 'html' || key === 'extraRobots' }" @update:model-value="emit('update:modelValue', $event ?? '')" />
  <IconPicker v-else-if="key === 'icon'" :model-value="typeof modelValue === 'string' ? modelValue : ''" @update:model-value="emit('update:modelValue', $event)" />
  <InputText v-else :id="inputId" :type="key === 'email' ? 'email' : 'text'" :model-value="modelValue as string | null" :invalid="key === 'email' && !!modelValue && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(modelValue))" class="w-full" @update:model-value="emit('update:modelValue', $event ?? '')" />

  <MediaPickerDialog v-if="isImage || imageCollection" v-model:visible="mediaVisible" header="选择图片" images-only @select="onMediaSelect($event.url)" />
</template>
