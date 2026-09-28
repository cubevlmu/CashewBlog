<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import Chart from "primevue/chart";
import type {
  AnalyticsOverviewDto,
  PostAnalyticsDto,
  Paged,
} from "../api/types";
import type { PageState } from "primevue/paginator";
import ResponsiveDataTable from "../components/ResponsiveDataTable.vue";
import { http } from "../api/http";
import { attempt, statusLabel, statusSeverity, dateLabel } from "../state";
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
function paginate(event: PageState) {
  page.value = event.page + 1;
  void load();
}
onMounted(() => load());
</script>
<template>
  <ResponsiveDataTable
    :value="posts?.items ?? []"
    :loading="busy"
    empty-text="暂无数据"
    table-style="min-width: 64rem"
    :page="page"
    :total-records="posts?.totalItems ?? 0"
    @page="paginate"
  >
    <template #filters
      ><SelectButton
        v-model="range"
        :allow-empty="false"
        :options="[
          { label: '7 天', value: '7d' },
          { label: '30 天', value: '30d' },
        ]"
        option-label="label"
        option-value="value"
        @change="load(true)" /><Select
        v-model="sort"
        :options="[
          { label: '总阅读', value: 'views' },
          { label: '今日', value: 'today' },
          { label: '7 天', value: 'views7d' },
          { label: '30 天', value: 'views30d' },
        ]"
        option-label="label"
        option-value="value"
        @change="load(true)"
    /></template>
    <template #before
      ><div class="space-y-3 border-b border-[var(--p-content-border-color)] p-4">
        <p class="text-sm text-[var(--p-text-muted-color)]">
          总阅读 {{ overview?.totalViews ?? "—" }} · 今日
          {{ overview?.todayViews ?? "—" }} · 时区 {{ overview?.timezone }}
        </p>
        <Chart type="line" :data="chart" :options="{ animation: false }"
      /></div>
    </template>
    <Column header="文章"
        ><template #body="{ data }"
          ><div class="flex min-w-0 flex-col gap-0.5">
            <span class="truncate font-medium">{{ data.title }}</span
            ><span
              class="truncate font-mono text-xs text-[var(--p-text-muted-color)]"
              >{{ data.slug }}</span
            >
          </div></template
      ></Column>
      <Column header="状态"
        ><template #body="{ data }"
          ><Tag
            :value="statusLabel(data.status)"
            :severity="statusSeverity(data.status)" /></template
      ></Column>
      <Column header="总阅读"
        ><template #body="{ data }"
          ><span class="font-semibold tabular-nums">{{
            data.viewCount
          }}</span></template
      ></Column>
      <Column header="今日"
        ><template #body="{ data }"
          ><span class="tabular-nums">{{ data.todayViews }}</span></template
      ></Column>
      <Column header="7 天"
        ><template #body="{ data }"
          ><span class="tabular-nums">{{ data.views7d }}</span></template
      ></Column>
      <Column header="30 天"
        ><template #body="{ data }"
          ><span class="tabular-nums">{{ data.views30d }}</span></template
      ></Column>
      <Column header="发布时间"
        ><template #body="{ data }"
          ><span class="text-[var(--p-text-muted-color)]">{{
            dateLabel(data.publishedAt)
          }}</span></template
      ></Column>
    <template #item="{ item: post }"
      ><article class="space-y-1.5 p-4">
        <div class="flex items-start justify-between gap-2">
          <span class="min-w-0 flex-1 font-medium">{{ post.title }}</span>
          <Tag
            :value="statusLabel(post.status)"
            :severity="statusSeverity(post.status)"
          />
        </div>
        <p class="truncate font-mono text-xs text-[var(--p-text-muted-color)]">
          {{ post.slug }}
        </p>
        <dl class="grid grid-cols-4 gap-2 text-xs">
          <div>
            <dt class="text-[var(--p-text-muted-color)]">总阅读</dt>
            <dd class="font-semibold tabular-nums">{{ post.viewCount }}</dd>
          </div>
          <div>
            <dt class="text-[var(--p-text-muted-color)]">今日</dt>
            <dd class="tabular-nums">{{ post.todayViews }}</dd>
          </div>
          <div>
            <dt class="text-[var(--p-text-muted-color)]">7 天</dt>
            <dd class="tabular-nums">{{ post.views7d }}</dd>
          </div>
          <div>
            <dt class="text-[var(--p-text-muted-color)]">30 天</dt>
            <dd class="tabular-nums">{{ post.views30d }}</dd>
          </div>
        </dl>
        <p class="text-xs text-[var(--p-text-muted-color)]">
          {{ dateLabel(post.publishedAt) }}
        </p>
      </article></template
    >
  </ResponsiveDataTable>
</template>
