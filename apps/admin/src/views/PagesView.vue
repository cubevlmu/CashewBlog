<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import ResponsiveDataTable from "../components/ResponsiveDataTable.vue";
import type { CustomPageDto } from "../api/types";
import { http } from "../api/http";
import { attempt, dateLabel } from "../state";
const pages = ref<
    Array<
      Pick<
        CustomPageDto,
        "id" | "title" | "slug" | "layout" | "createdAt" | "updatedAt"
      >
    >
  >([]),
  router = useRouter();
onMounted(async () => {
  await attempt(async () => {
    pages.value = await http.get<typeof pages.value>("/api/admin/pages");
  });
});
</script>
<template>
  <ResponsiveDataTable
    :value="pages"
    empty-text="暂无页面"
    table-style="min-width: 48rem"
    :paginator="false"
  >
    <template #actions
      ><Button
        icon="pi pi-plus"
        aria-label="新建页面"
        title="新建页面"
        @click="router.push('/admin/pages/new')"
    /></template>
    <Column header="页面"
        ><template #body="{ data }"
          ><div class="flex items-center gap-3">
            <span
              class="flex size-10 shrink-0 items-center justify-center rounded-md bg-[var(--p-surface-100)] text-[var(--p-primary-color)] ring-1 ring-[var(--p-content-border-color)]"
              ><i class="pi pi-code" /></span
            ><span class="flex min-w-0 flex-col gap-0.5"
              ><RouterLink
                :to="`/admin/pages/${data.id}`"
                class="truncate font-medium hover:underline"
                >{{ data.title }}</RouterLink
              ><span
                class="truncate font-mono text-xs text-[var(--p-text-muted-color)]"
                >{{ data.slug }}</span
              ></span
            ></div
          ></template
      ></Column>
      <Column header="布局"
        ><template #body="{ data }"
          ><Tag :value="data.layout" severity="secondary" /></template
      ></Column>
      <Column header="更新时间"
        ><template #body="{ data }"
          ><span class="text-[var(--p-text-muted-color)]">{{
            dateLabel(data.updatedAt)
          }}</span></template
      ></Column>
      <Column header="操作"
        ><template #body="{ data }"
          ><Button
            icon="pi pi-pencil"
            text
            rounded
            aria-label="编辑"
            title="编辑"
            @click="router.push(`/admin/pages/${data.id}`)" /></template
      ></Column>
    <template #item="{ item: data }"
      ><article class="flex items-start gap-3 p-4">
        <span
          class="flex size-10 shrink-0 items-center justify-center rounded-md bg-[var(--p-surface-100)] text-[var(--p-primary-color)] ring-1 ring-[var(--p-content-border-color)]"
          ><i class="pi pi-code" /></span
        ><span class="min-w-0 flex-1 space-y-1.5"
          ><span class="flex items-start justify-between gap-2"
            ><RouterLink
              :to="`/admin/pages/${data.id}`"
              class="min-w-0 flex-1 font-medium"
              >{{ data.title }}</RouterLink
            ><Tag :value="data.layout" severity="secondary" /></span
          ><span
            class="block truncate font-mono text-xs text-[var(--p-text-muted-color)]"
            >{{ data.slug }}</span
          ><span class="flex items-center justify-between gap-2"
            ><span class="text-xs text-[var(--p-text-muted-color)]">{{
              dateLabel(data.updatedAt)
            }}</span
            ><Button
              icon="pi pi-pencil"
              text
              rounded
              aria-label="编辑"
              title="编辑"
              @click="router.push(`/admin/pages/${data.id}`)" /></span
        ></span>
      </article></template
    >
  </ResponsiveDataTable>
</template>
