<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount, ref } from "vue";
import { useConfirm } from "primevue/useconfirm";
import DashboardWidget from "../components/DashboardWidget.vue";
import { GridLayout, GridItem } from "grid-layout-plus";
import { http } from "../api/http";
import type {
  AnalyticsOverviewDto,
  SystemInfoDto,
  SiteSettings,
} from "../api/types";
import { attempt } from "../state";
const mobileQuery = window.matchMedia("(max-width: 767px)");
const isMobile = ref(mobileQuery.matches);
const updateMobile = (event: MediaQueryListEvent) => {
  isMobile.value = event.matches;
};
mobileQuery.addEventListener("change", updateMobile);
onBeforeUnmount(() => mobileQuery.removeEventListener("change", updateMobile));
const confirm = useConfirm();
const overview = ref<AnalyticsOverviewDto>(),
  info = ref<SystemInfoDto>();
type Placement = { i: string; x: number; y: number; w: number; h: number };
const layout = ref<Placement[]>([]),
  hidden = ref<string[]>([]),
  edit = ref(false),
  saved = ref(false);
/** Layout before entering edit mode, restored by 取消. */
let snapshot = "";
const names: Record<string, string> = {
  totalPosts: "文章总数",
  drafts: "草稿",
  trash: "回收站",
  totalViews: "总访问量",
  todayViews: "今日访问量",
  viewsTrend: "访问趋势",
  popularPosts: "热门文章",
  recentPosts: "最近文章",
  runtime: "运行环境",
  cpu: "CPU",
  memory: "内存",
  disk: "磁盘",
  database: "数据库",
  mediaStorage: "媒体存储",
};
const allIds = Object.keys(names);
const visibleLayout = computed(() =>
  [...layout.value]
    .filter((w) => !hidden.value.includes(w.i))
    .sort((a, b) => a.y - b.y || a.x - b.x),
);
const loading = ref(false);
async function refresh() {
  loading.value = true;
  await attempt(async () => {
    [overview.value, info.value] = await Promise.all([
      http.get<AnalyticsOverviewDto>("/api/admin/analytics/overview", {
        range: "30d",
      }),
      http.get<SystemInfoDto>("/api/admin/system/info"),
    ]);
  });
  loading.value = false;
}
function applySettings(settings: SiteSettings) {
  layout.value = settings.dashboard.widgets.map((w) => ({
    i: w.id,
    x: w.x,
    y: w.y,
    w: w.w,
    h: w.h,
  }));
  for (const [index, id] of allIds.entries())
    if (!layout.value.some((w) => w.i === id))
      layout.value.push({
        i: id,
        x: (index % 3) * 4,
        y: Math.floor(index / 3) * 3,
        w: 4,
        h: 3,
      });
  hidden.value = settings.dashboard.widgets
    .filter((w) => !w.visible)
    .map((w) => w.id);
}
function startEdit() {
  snapshot = JSON.stringify({ layout: layout.value, hidden: hidden.value });
  saved.value = false;
  edit.value = true;
}
function cancelEdit() {
  const previous = JSON.parse(snapshot) as { layout: Placement[]; hidden: string[] };
  layout.value = previous.layout;
  hidden.value = previous.hidden;
  edit.value = false;
}
function toggleWidget(id: string) {
  hidden.value = hidden.value.includes(id)
    ? hidden.value.filter((item) => item !== id)
    : [...hidden.value, id];
}
function resetLayout() {
  confirm.require({
    header: "恢复默认布局",
    message: "仪表盘将恢复默认的组件、位置与大小，确定继续？",
    acceptLabel: "恢复默认",
    rejectLabel: "取消",
    accept: () =>
      attempt(async () => {
        applySettings(
          await http.post<SiteSettings>("/api/admin/settings/reset/dashboard"),
        );
        saved.value = true;
        edit.value = false;
      }),
  });
}
async function save() {
  await attempt(async () => {
    await http.put("/api/admin/settings", {
      dashboard: {
        widgets: layout.value.map((w) => ({
          id: w.i,
          x: w.x,
          y: w.y,
          w: w.w,
          h: w.h,
          visible: !hidden.value.includes(w.i),
        })),
      },
    });
    saved.value = true;
    edit.value = false;
  });
}
onMounted(async () => {
  await refresh();
  await attempt(async () =>
    applySettings(await http.get<SiteSettings>("/api/admin/settings")),
  );
});
</script>
<template>
  <div class="space-y-4">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <p class="text-sm text-[var(--p-text-muted-color)]">
        过去 30 天的站点概览
      </p>
      <div v-if="!edit" class="flex items-center gap-2">
        <Button
          label="刷新"
          icon="pi pi-refresh"
          size="small"
          severity="secondary"
          outlined
          :loading="loading"
          @click="refresh"
        /><Button
          label="调整布局"
          icon="pi pi-objects-column"
          size="small"
          severity="secondary"
          text
          class="!hidden md:!inline-flex"
          @click="startEdit"
        />
      </div>
    </div>
    <Message v-if="saved" severity="success" closable @close="saved = false"
      >布局已保存</Message
    >
    <div
      v-if="edit && !isMobile"
      class="sticky top-0 z-20 flex flex-col gap-3 rounded-xl border border-dashed border-[var(--p-primary-color)] bg-[var(--p-content-background)] px-4 py-3 shadow-sm"
      role="region"
      aria-label="布局编辑"
    >
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div class="flex min-w-0 items-center gap-3">
          <span
            class="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[var(--p-primary-color)] text-[var(--p-primary-contrast-color)]"
            ><i class="pi pi-objects-column" aria-hidden="true"
          /></span>
          <div class="min-w-0">
            <div class="text-sm font-semibold">正在调整仪表盘布局</div>
            <div class="text-xs text-[var(--p-text-muted-color)]">
              拖动组件移动位置，拖动右下角调整大小，点击眼睛图标隐藏或显示组件。
            </div>
          </div>
        </div>
        <div class="flex shrink-0 gap-2">
          <Button
            label="恢复默认"
            icon="pi pi-replay"
            size="small"
            severity="secondary"
            text
            @click="resetLayout"
          />
          <Button
            label="取消"
            size="small"
            severity="secondary"
            outlined
            @click="cancelEdit"
          />
          <Button label="保存布局" icon="pi pi-check" size="small" @click="save" />
        </div>
      </div>
      <div
        v-if="hidden.length"
        class="flex flex-wrap items-center gap-2 border-t border-[var(--p-content-border-color)] pt-3"
      >
        <span class="text-xs text-[var(--p-text-muted-color)]"
          >已隐藏 {{ hidden.length }} 个组件，点击恢复显示：</span
        >
        <Button
          v-for="id in hidden"
          :key="id"
          :label="names[id] ?? id"
          icon="pi pi-eye"
          size="small"
          severity="secondary"
          outlined
          rounded
          @click="toggleWidget(id)"
        />
      </div>
    </div>
    <div v-if="!isMobile">
      <GridLayout
        v-if="layout.length"
        v-model:layout="layout"
        :col-num="12"
        :row-height="70"
        :margin="[16, 16]"
        :is-draggable="edit"
        :is-resizable="edit"
        :responsive="false"
        :class="{ 'dashboard-editing': edit }"
      >
        <GridItem
          v-for="widget in layout"
          v-show="edit || !hidden.includes(widget.i)"
          :key="widget.i"
          v-bind="widget"
          ><div class="relative h-full" :class="{ 'cursor-move': edit }">
            <DashboardWidget
              :id="widget.i"
              :title="names[widget.i] ?? widget.i"
              :overview="overview"
              :info="info"
              :class="{
                'opacity-40 grayscale': edit && hidden.includes(widget.i),
              }"
            />
            <div
              v-if="edit"
              class="absolute -top-3.5 right-4 z-10 flex items-center gap-1"
            >
              <Tag
                v-if="hidden.includes(widget.i)"
                value="已隐藏"
                severity="secondary"
              />
              <Button
                :icon="
                  hidden.includes(widget.i) ? 'pi pi-eye-slash' : 'pi pi-eye'
                "
                rounded
                size="small"
                :severity="hidden.includes(widget.i) ? 'secondary' : 'contrast'"
                :outlined="hidden.includes(widget.i)"
                :aria-label="`${hidden.includes(widget.i) ? '显示' : '隐藏'}${names[widget.i] ?? widget.i}`"
                :title="hidden.includes(widget.i) ? '显示组件' : '隐藏组件'"
                @click="toggleWidget(widget.i)"
              />
            </div></div
        ></GridItem>
      </GridLayout>
    </div>
    <div v-else class="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div
        v-for="widget in visibleLayout"
        :key="widget.i"
        :class="[
          'min-w-0',
          ['viewsTrend', 'popularPosts', 'recentPosts'].includes(widget.i)
            ? 'sm:col-span-2 min-h-64'
            : 'min-h-36',
        ]"
      >
        <DashboardWidget
          :id="widget.i"
          :title="names[widget.i] ?? widget.i"
          :overview="overview"
          :info="info"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Edit mode: outline every widget and tint the drop placeholder with the theme colour. */
.dashboard-editing :deep(.vgl-item:not(.vgl-item--placeholder)) {
  border-radius: 0.75rem;
  outline: 2px dashed var(--p-content-border-color);
  outline-offset: 2px;
}
.dashboard-editing :deep(.vgl-item--placeholder) {
  border-radius: 0.75rem;
  background: color-mix(in srgb, var(--p-primary-color) 18%, transparent);
  opacity: 1;
}
</style>
