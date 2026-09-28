<script setup lang="ts">
import { computed } from "vue";
import Chart from "primevue/chart";
import Skeleton from "primevue/skeleton";
import { useRouter } from "vue-router";
import type { AnalyticsOverviewDto, SystemInfoDto } from "../api/types";
import { bytesLabel, dateLabel, statusLabel } from "../state";
import { dark } from "../theme";
const props = defineProps<{
  id: string;
  title: string;
  overview?: AnalyticsOverviewDto;
  info?: SystemInfoDto;
}>();
const router = useRouter();
const icons: Record<string, string> = {
  totalPosts: "file-edit",
  drafts: "pencil",
  trash: "trash",
  totalViews: "eye",
  todayViews: "chart-line",
  viewsTrend: "chart-bar",
  popularPosts: "star",
  recentPosts: "clock",
  runtime: "server",
  cpu: "microchip",
  memory: "database",
  disk: "hard-drive",
  database: "database",
  mediaStorage: "images",
};
const metric = computed(() =>
  ["totalPosts", "drafts", "trash", "totalViews", "todayViews"].includes(
    props.id,
  ),
);
const value = computed(() => {
  const info = props.info,
    overview = props.overview;
  if (!info || !overview) return "—";
  if (metric.value)
    return overview[props.id as "totalPosts"].toLocaleString("zh-CN");
  switch (props.id) {
    case "cpu":
      return info.cpuUsagePercent === null
        ? "—"
        : `${info.cpuUsagePercent.toFixed(1)}%`;
    case "memory":
      return bytesLabel(info.processMemoryBytes);
    case "disk":
      return bytesLabel(info.uploadsDisk.freeBytes);
    case "database":
      return info.database.healthy ? "运行正常" : "连接异常";
    case "mediaStorage":
      return `${info.mediaCount} 个文件`;
    case "runtime":
      return `CashewBlog ${info.version}`;
    default:
      return "—";
  }
});
const detail = computed(() => {
  const info = props.info,
    overview = props.overview;
  if (!info || !overview) return "";
  switch (props.id) {
    case "totalPosts":
      return `已发布 ${overview.publishedPosts} · 私密 ${overview.privatePosts}`;
    case "drafts":
      return "等待下一次灵感，继续创作";
    case "trash":
      return "30 天内可以恢复";
    case "totalViews":
      return "公开文章累计阅读量";
    case "todayViews":
      return `统计时区 ${overview.timezone}`;
    case "cpu":
      return `${info.processorCount} 核 · 应用进程使用率`;
    case "memory":
      return `系统内存 ${bytesLabel(info.systemMemoryTotalBytes)}`;
    case "disk":
      return `媒体磁盘可用 / 总计 ${bytesLabel(info.uploadsDisk.totalBytes)}`;
    case "database":
      return `PostgreSQL ${info.database.serverVersion ?? "—"} · ${info.database.latencyMs ?? "—"} ms`;
    case "mediaStorage":
      return `占用 ${bytesLabel(info.uploadsUsageBytes)}`;
    case "runtime":
      return `${info.dotnetVersion} · 已运行 ${Math.floor(info.uptimeSeconds / 60)} 分钟`;
    default:
      return "";
  }
});
const chart = computed(() => ({
  labels: props.overview?.daily.map((d) => d.date.slice(5)),
  datasets: [
    {
      label: "阅读量",
      data: props.overview?.daily.map((d) => d.views),
      borderColor: "#f97316",
      backgroundColor: dark.value ? "#f9731620" : "#fff7ed",
      fill: true,
      tension: 0.35,
      pointRadius: 0,
      borderWidth: 2,
    },
  ],
}));
const chartOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  animation: false as const,
  plugins: { legend: { display: false } },
  scales: {
    x: {
      grid: { display: false },
      ticks: { maxTicksLimit: 8, color: dark.value ? "#a1a1aa" : "#64748b" },
    },
    y: {
      beginAtZero: true,
      ticks: { precision: 0, color: dark.value ? "#a1a1aa" : "#64748b" },
      grid: { color: dark.value ? "#27272a" : "#f1f5f9" },
    },
  },
}));
</script>
<template>
  <Card
    class="h-full overflow-hidden border border-[var(--p-content-border-color)] !shadow-none"
    :pt="{
      body: { class: '!h-full !gap-3 !p-5' },
      content: { class: 'min-h-0 flex-1' },
    }"
  >
    <template #title
      ><div class="flex items-center justify-between gap-3">
        <span class="text-sm font-medium text-[var(--p-text-muted-color)]">{{
          title
        }}</span
        ><span
          class="flex size-8 shrink-0 items-center justify-center rounded-lg bg-orange-50 text-orange-600 dark:bg-orange-950 dark:text-orange-400"
          ><i :class="['pi', `pi-${icons[id] ?? 'circle'}`, '!text-sm']"
        /></span></div
    ></template>
    <template #content>
      <Skeleton v-if="!overview || !info" height="2rem" width="45%" />
      <div v-else-if="id === 'viewsTrend'" class="h-full min-h-36">
        <Chart
          type="line"
          :data="chart"
          :options="chartOptions"
          class="h-full"
        />
      </div>
      <DataTable
        v-else-if="id === 'popularPosts'"
        :value="overview.topPosts"
        size="small"
        scrollable
        scroll-height="flex"
        class="h-full"
        :pt="{
          root: { class: 'text-sm' },
          tableContainer: { class: 'max-h-64' },
        }"
        ><template #empty>发布第一篇文章后，这里会显示阅读排行。</template
        ><Column header="文章"
          ><template #body="{ data }"
            ><Button
              :label="data.title"
              text
              size="small"
              class="!p-0 text-left"
              @click="
                router.push(`/admin/posts/${data.id}`)
              " /></template></Column
        ><Column field="viewCount" header="阅读"
      /></DataTable>
      <DataTable
        v-else-if="id === 'recentPosts'"
        :value="overview.recentPosts"
        size="small"
        scrollable
        scroll-height="flex"
        class="h-full"
        :pt="{ tableContainer: { class: 'max-h-64' } }"
        ><template #empty>还没有文章，开始写下第一篇内容吧。</template
        ><Column header="文章"
          ><template #body="{ data }"
            ><Button
              :label="data.title"
              text
              size="small"
              class="!p-0 text-left"
              @click="
                router.push(`/admin/posts/${data.id}`)
              " /></template></Column
        ><Column header="状态"
          ><template #body="{ data }"
            ><Tag
              :value="statusLabel(data.status)"
              :severity="
                data.status === 'published' ? 'success' : 'secondary'
              " /></template></Column
        ><Column header="更新"
          ><template #body="{ data }"
            ><span class="text-xs text-[var(--p-text-muted-color)]">{{
              dateLabel(data.updatedAt)
            }}</span></template
          ></Column
        ></DataTable
      >
      <div v-else>
        <p
          :class="[
            'font-semibold tracking-tight',
            metric ? 'text-3xl' : 'text-xl',
          ]"
        >
          {{ value }}
        </p>
        <p
          class="mt-2 text-xs leading-relaxed text-[var(--p-text-muted-color)]"
        >
          {{ detail }}
        </p>
      </div>
    </template>
  </Card>
</template>
