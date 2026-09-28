<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount, ref } from "vue";
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
const overview = ref<AnalyticsOverviewDto>(),
  info = ref<SystemInfoDto>();
const layout = ref<
    Array<{ i: string; x: number; y: number; w: number; h: number }>
  >([]),
  hidden = ref<string[]>([]),
  edit = ref(false),
  saved = ref(false);
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
  await attempt(async () => {
    const settings = await http.get<SiteSettings>("/api/admin/settings");
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
  });
});
</script>
<template>
  <div class="space-y-4">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <p class="text-sm text-[var(--p-text-muted-color)]">
        过去 30 天的站点概览
      </p>
      <div class="flex items-center gap-2">
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
          icon="pi pi-sliders-h"
          size="small"
          severity="secondary"
          text
          class="!hidden md:!inline-flex"
          @click="edit = !edit"
        /><Button v-if="edit" label="保存布局" size="small" @click="save" />
      </div>
    </div>
    <Message v-if="saved" severity="success" closable @close="saved = false"
      >布局已保存</Message
    >
    <Field v-if="edit" label="隐藏组件"
      ><MultiSelect
        v-model="hidden"
        :options="allIds.map((id) => ({ label: names[id], value: id }))"
        option-label="label"
        option-value="value"
    /></Field>
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
      >
        <GridItem
          v-for="widget in layout"
          v-show="edit || !hidden.includes(widget.i)"
          :key="widget.i"
          v-bind="widget"
          ><DashboardWidget
            :id="widget.i"
            :title="names[widget.i] ?? widget.i"
            :overview="overview"
            :info="info"
        /></GridItem>
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
