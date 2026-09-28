<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import Chart from "primevue/chart";
import { GridLayout, GridItem } from "grid-layout-plus";
import { http } from "../api/http";
import type {
  AnalyticsOverviewDto,
  SystemInfoDto,
  SiteSettings,
} from "../api/types";
import { attempt, dateLabel, bytesLabel, statusLabel } from "../state";
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
const chart = computed(() => ({
  labels: overview.value?.daily.map((d) => d.date) ?? [],
  datasets: [
    {
      label: "阅读量",
      data: overview.value?.daily.map((d) => d.views) ?? [],
      borderColor: "#10b981",
      fill: false,
    },
  ],
}));
function value(id: string) {
  if (!overview.value || !info.value) return "—";
  if (
    ["totalPosts", "drafts", "trash", "totalViews", "todayViews"].includes(id)
  )
    return String(overview.value[id as "totalPosts"]);
  switch (id) {
    case "runtime":
      return `${info.value.version} · ${info.value.dotnetVersion} · Node ${info.value.nodeVersion ?? "—"} · Astro ${info.value.astroVersion ?? "—"} · 已运行 ${Math.floor(info.value.uptimeSeconds / 60)} 分钟`;
    case "cpu":
      return info.value.cpuUsagePercent === null
        ? "—"
        : `${info.value.cpuUsagePercent.toFixed(1)}%`;
    case "memory":
      return `进程 ${bytesLabel(info.value.processMemoryBytes)} / 系统 ${bytesLabel(info.value.systemMemoryTotalBytes)}`;
    case "disk":
      return `媒体磁盘可用 ${bytesLabel(info.value.uploadsDisk.freeBytes)} / 配置磁盘可用 ${bytesLabel(info.value.dataDisk.freeBytes)}`;
    case "database":
      return `${info.value.database.healthy ? "正常" : "异常"} · ${info.value.database.serverVersion ?? ""} · ${info.value.database.latencyMs ?? "—"} ms`;
    case "mediaStorage":
      return `${info.value.mediaCount} 项 · ${bytesLabel(info.value.uploadsUsageBytes)}`;
    default:
      return "—";
  }
}
async function refresh() {
  await attempt(async () => {
    [overview.value, info.value] = await Promise.all([
      http.get<AnalyticsOverviewDto>("/api/admin/analytics/overview", {
        range: "30d",
      }),
      http.get<SystemInfoDto>("/api/admin/system/info"),
    ]);
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
  <Panel header="仪表盘"
    ><Toolbar
      ><template #start
        ><Button label="刷新" icon="pi pi-refresh" @click="refresh" /></template
      ><template #end
        ><Button
          label="调整布局"
          severity="secondary"
          @click="edit = !edit" /><Button
          v-if="edit"
          label="保存布局"
          @click="save" /></template></Toolbar
    ><Message v-if="saved" severity="success">布局已保存</Message>
    <Field v-if="edit" label="隐藏组件"
      ><MultiSelect
        v-model="hidden"
        :options="allIds.map((id) => ({ label: names[id], value: id }))"
        option-label="label"
        option-value="value"
    /></Field>
    <GridLayout
      v-if="layout.length"
      v-model:layout="layout"
      :col-num="12"
      :row-height="70"
      :is-draggable="edit"
      :is-resizable="edit"
      :responsive="true"
    >
      <GridItem
        v-for="widget in layout"
        v-show="edit || !hidden.includes(widget.i)"
        :key="widget.i"
        v-bind="widget"
      >
        <Panel :header="names[widget.i] ?? widget.i">
          <Chart
            v-if="widget.i === 'viewsTrend'"
            type="line"
            :data="chart"
            :options="{
              maintainAspectRatio: true,
              aspectRatio: 4,
              animation: false,
            }"
          />
          <DataTable
            v-else-if="widget.i === 'popularPosts'"
            :value="overview?.topPosts ?? []"
            scrollable
            scroll-height="180px"
            ><Column field="title" header="标题" /><Column
              field="viewCount"
              header="阅读"
          /></DataTable>
          <DataTable
            v-else-if="widget.i === 'recentPosts'"
            :value="overview?.recentPosts ?? []"
            scrollable
            scroll-height="180px"
            ><Column field="title" header="标题" /><Column header="状态"
              ><template #body="{ data }">{{
                statusLabel(data.status)
              }}</template></Column
            ><Column header="更新时间"
              ><template #body="{ data }">{{
                dateLabel(data.updatedAt)
              }}</template></Column
            ></DataTable
          >
          <p v-else>{{ value(widget.i) }}</p>
        </Panel>
      </GridItem>
    </GridLayout>
  </Panel>
</template>
