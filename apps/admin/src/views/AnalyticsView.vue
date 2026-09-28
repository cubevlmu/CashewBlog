<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import Chart from "primevue/chart";
import type {
  AnalyticsOverviewDto,
  PostAnalyticsDto,
  Paged,
} from "../api/types";
import type { DataTablePageEvent } from "primevue/datatable";
import { http } from "../api/http";
import { attempt, dateLabel } from "../state";
const overview = ref<AnalyticsOverviewDto>(),
  posts = ref<Paged<PostAnalyticsDto>>(),
  range = ref("30d"),
  sort = ref("views"),
  page = ref(1),
  busy = ref(false);
const chart = computed(() => ({
  labels: overview.value?.daily.map((d) => d.date) ?? [],
  datasets: [
    {
      label: "阅读量",
      data: overview.value?.daily.map((d) => d.views) ?? [],
      borderColor: "#10b981",
    },
  ],
}));
async function load(reset = false) {
  if (reset) page.value = 1;
  busy.value = true;
  await attempt(async () => {
    [overview.value, posts.value] = await Promise.all([
      http.get<AnalyticsOverviewDto>("/api/admin/analytics/overview", {
        range: range.value,
      }),
      http.get<Paged<PostAnalyticsDto>>("/api/admin/analytics/posts", {
        page: page.value,
        pageSize: 20,
        sort: sort.value,
      }),
    ]);
  });
  busy.value = false;
}
function paginate(event: DataTablePageEvent) {
  page.value = event.page + 1;
  void load();
}
onMounted(() => load());
</script>
<template>
  <Panel header="访问统计"
    ><Toolbar
      ><template #start
        ><SelectButton
          v-model="range"
          :allow-empty="false"
          :options="[
            { label: '7 天', value: '7d' },
            { label: '30 天', value: '30d' },
          ]"
          option-label="label"
          option-value="value"
          @change="load(true)" /></template
      ><template #end
        ><Select
          v-model="sort"
          :options="[
            { label: '总阅读', value: 'views' },
            { label: '今日', value: 'today' },
            { label: '7 天', value: 'views7d' },
            { label: '30 天', value: 'views30d' },
          ]"
          option-label="label"
          option-value="value"
          @change="load(true)" /></template
    ></Toolbar>
    <p>
      总阅读 {{ overview?.totalViews ?? "—" }} · 今日
      {{ overview?.todayViews ?? "—" }} · 时区 {{ overview?.timezone }}
    </p>
    <Chart
      type="line"
      :data="chart"
      :options="{ animation: false }"
    /><DataTable
      :value="posts?.items ?? []"
      :loading="busy"
      lazy
      paginator
      :rows="20"
      :first="(page - 1) * 20"
      :total-records="posts?.totalItems ?? 0"
      @page="paginate"
      ><Column field="title" header="标题" /><Column
        field="viewCount"
        header="总阅读"
      /><Column field="todayViews" header="今日" /><Column
        field="views7d"
        header="7 天"
      /><Column field="views30d" header="30 天" /><Column header="发布时间"
        ><template #body="{ data }">{{
          dateLabel(data.publishedAt)
        }}</template></Column
      ></DataTable
    ></Panel
  >
</template>
