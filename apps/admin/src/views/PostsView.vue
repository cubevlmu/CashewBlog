<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { useConfirm } from "primevue/useconfirm";
import type { PageState } from "primevue/paginator";
import GroupedFilterSelect from "../components/GroupedFilterSelect.vue";
import ResponsiveDataTable from "../components/ResponsiveDataTable.vue";
import { PAGE_SIZE } from "../pagination";
import type {
  AdminPostListItemDto,
  AdminCategoryDto,
  AdminTagDto,
  Paged,
} from "../api/types";
import { http } from "../api/http";
import {
  attempt,
  statuses,
  statusLabel,
  statusSeverity,
  dateLabel,
} from "../state";
const props = defineProps<{ trash?: boolean }>();
const router = useRouter(),
  confirm = useConfirm();
const data = ref<Paged<AdminPostListItemDto>>(),
  selected = ref<AdminPostListItemDto[]>([]);
const categories = ref<AdminCategoryDto[]>([]),
  tags = ref<AdminTagDto[]>([]);
const q = ref(""),
  /** Selected filter values, prefixed by group: `status:`, `category:`, `tag:`. */
  filters = ref<string[]>([]);
const page = ref(1),
  busy = ref(false);
const filterGroups = computed(() =>
  [
    {
      label: "状态",
      items: statuses.map((item) => ({
        label: item.label,
        value: `status:${item.value}`,
      })),
    },
    {
      label: "分类",
      items: categories.value.map((item) => ({
        label: item.name,
        value: `category:${item.id}`,
      })),
    },
    {
      label: "标签",
      items: tags.value.map((item) => ({
        label: item.name,
        value: `tag:${item.id}`,
      })),
    },
  ].filter((group) => group.items.length),
);
const filterValue = (group: string) =>
  filters.value.find((value) => value.startsWith(`${group}:`))?.slice(group.length + 1) ?? "";
async function load(reset = false) {
  if (reset) page.value = 1;
  busy.value = true;
  await attempt(async () => {
    data.value = await http.get("/api/admin/posts", {
      page: page.value,
      pageSize: PAGE_SIZE,
      q: q.value,
      status: filterValue("status"),
      categoryId: filterValue("category"),
      tagId: filterValue("tag"),
      trash: props.trash,
    });
    selected.value = [];
  });
  busy.value = false;
}
function paginate(event: PageState) {
  page.value = event.page + 1;
  void load();
}
function remove(post?: AdminPostListItemDto) {
  confirm.require({
    header: props.trash ? "永久删除" : "移入回收站",
    message: props.trash
      ? "永久删除后无法恢复，确定继续？"
      : "文章将保留在回收站 30 天，确定继续？",
    acceptLabel: "确认删除",
    rejectLabel: "取消",
    accept: () =>
      attempt(async () => {
        if (post)
          await http.del(
            `/api/admin/posts/${post.id}${props.trash ? "/permanent" : ""}`,
          );
        else
          await http.post("/api/admin/posts/bulk-delete", {
            ids: selected.value.map((item) => item.id),
          });
        await load();
      }),
  });
}
async function restore(id: string) {
  await attempt(async () => {
    await http.post(`/api/admin/posts/${id}/restore`);
    await load();
  });
}
onMounted(async () => {
  await load();
  await attempt(async () => {
    [categories.value, tags.value] = await Promise.all([
      http.get<AdminCategoryDto[]>("/api/admin/categories"),
      http.get<AdminTagDto[]>("/api/admin/tags"),
    ]);
  });
});
</script>
<template>
  <ResponsiveDataTable
    v-model:selection="selected"
    :value="data?.items ?? []"
    :loading="busy"
    data-key="id"
    :empty-text="trash ? '回收站是空的' : '暂无文章'"
    table-style="min-width: 68rem"
    :page="page"
    :total-records="data?.totalItems ?? 0"
    @page="paginate"
  >
    <template #filters
      ><GroupedFilterSelect
        v-model="filters"
        :groups="filterGroups"
        label="筛选文章"
        placeholder="筛选"
        @change="load(true)"
      /></template
    >
    <template #search
      ><form @submit.prevent="load(true)">
        <InputText
          v-model="q"
          placeholder="搜索标题或 slug"
          aria-label="搜索文章"
        /></form
    ></template>
    <template #actions
      ><Button
        v-if="!trash"
        icon="pi pi-plus"
        aria-label="新建文章"
        title="新建文章"
        @click="router.push('/admin/posts/new')" /><Button
        v-if="!trash"
        icon="pi pi-trash"
        severity="danger"
        text
        rounded
        :disabled="!selected.length"
        aria-label="批量删除"
        title="批量删除"
        class="hidden md:inline-flex"
        @click="remove()"
    /></template>
    <Column v-if="!trash" selection-mode="multiple" /><Column header="文章"
      ><template #body="{ data: post }"
        ><div class="flex items-center gap-3">
          <span
            class="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-md bg-[var(--p-surface-100)] ring-1 ring-[var(--p-content-border-color)]"
            ><img
              v-if="post.cover"
              :src="post.cover.thumbUrl ?? post.cover.url"
              alt=""
              class="size-12 object-cover" /><i
              v-else
              class="pi pi-file-edit text-[var(--p-text-muted-color)]"
          /></span>
          <div class="flex min-w-0 flex-col gap-0.5">
            <RouterLink
              v-if="!trash"
              :to="`/admin/posts/${post.id}`"
              class="truncate font-medium hover:underline"
              >{{ post.title }}</RouterLink
            ><span v-else class="truncate font-medium">{{ post.title }}</span
            ><span
              class="truncate font-mono text-xs text-[var(--p-text-muted-color)]"
              >{{ post.slug }}</span
            ><Tag
              v-if="post.hasWorkingCopy"
              value="有未发布修改"
              severity="warn"
              class="!w-fit"
            />
          </div></div></template
    ></Column>
    <Column header="状态"
      ><template #body="{ data: post }"
        ><Tag
          :value="statusLabel(post.status)"
          :severity="statusSeverity(post.status)" /></template
    ></Column>
    <Column header="分类"
      ><template #body="{ data: post }"
        ><Tag
          v-if="post.category"
          :value="post.category.name"
          severity="secondary"
        /><span v-else class="text-[var(--p-text-muted-color)]"
          >—</span
        ></template
      ></Column
    >
    <Column header="标签"
      ><template #body="{ data: post }"
        ><div v-if="post.tags.length" class="flex flex-wrap gap-1">
          <Tag
            v-for="tag in post.tags"
            :key="tag.id"
            :value="tag.name"
            severity="secondary"
          />
        </div>
        <span v-else class="text-[var(--p-text-muted-color)]">—</span></template
      ></Column
    >
    <Column header="发布时间"
      ><template #body="{ data: post }">{{
        dateLabel(post.publishedAt)
      }}</template></Column
    ><Column header="更新时间"
      ><template #body="{ data: post }">{{
        dateLabel(post.updatedAt)
      }}</template></Column
    ><Column header="阅读"
      ><template #body="{ data: post }"
        ><span class="font-semibold tabular-nums">{{
          post.viewCount
        }}</span></template
      ></Column
    >
    <Column header="操作"
      ><template #body="{ data: post }"
        ><div class="flex justify-end gap-0.5">
          <Button
            v-if="trash"
            icon="pi pi-replay"
            text
            rounded
            aria-label="恢复"
            title="恢复"
            @click="restore(post.id)"
          /><Button
            v-else
            as="a"
            :href="`/posts/${encodeURIComponent(post.slug)}?preview=true`"
            target="_blank"
            rel="noopener"
            icon="pi pi-external-link"
            text
            rounded
            aria-label="预览"
            title="预览"
          /><Button
            icon="pi pi-trash"
            text
            rounded
            severity="danger"
            :aria-label="trash ? '永久删除' : '删除'"
            :title="trash ? '永久删除' : '删除'"
            @click="remove(post)"
          /></div></template
    ></Column>
    <template #item="{ item: post }"
      ><article class="flex items-start gap-3 p-4">
        <span
          class="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-md bg-[var(--p-surface-100)] ring-1 ring-[var(--p-content-border-color)]"
          ><img
            v-if="post.cover"
            :src="post.cover.thumbUrl ?? post.cover.url"
            alt=""
            class="size-12 object-cover" /><i
            v-else
            class="pi pi-file-edit text-[var(--p-text-muted-color)]"
        /></span>
        <div class="min-w-0 flex-1 space-y-1.5">
          <div class="flex items-start justify-between gap-2">
            <RouterLink
              v-if="!trash"
              :to="`/admin/posts/${post.id}`"
              class="min-w-0 flex-1 font-medium"
              >{{ post.title }}</RouterLink
            ><span v-else class="min-w-0 flex-1 font-medium">{{
              post.title
            }}</span
            ><Tag
              :value="statusLabel(post.status)"
              :severity="statusSeverity(post.status)"
            />
          </div>
          <p
            class="truncate font-mono text-xs text-[var(--p-text-muted-color)]"
          >
            {{ post.slug }}
          </p>
          <div class="flex flex-wrap gap-1">
            <Tag
              v-if="post.category"
              :value="post.category.name"
              severity="secondary"
            /><Tag
              v-for="tag in post.tags"
              :key="tag.id"
              :value="tag.name"
              severity="secondary"
            /><Tag
              v-if="post.hasWorkingCopy"
              value="有未发布修改"
              severity="warn"
            />
          </div>
          <p class="text-xs text-[var(--p-text-muted-color)]">
            {{ dateLabel(post.publishedAt) }} · 阅读 {{ post.viewCount }}
          </p>
          <div class="flex justify-end gap-0.5">
            <Button
              v-if="trash"
              icon="pi pi-replay"
              text
              rounded
              aria-label="恢复"
              title="恢复"
              @click="restore(post.id)"
            /><Button
              v-else
              as="a"
              :href="`/posts/${encodeURIComponent(post.slug)}?preview=true`"
              target="_blank"
              rel="noopener"
              icon="pi pi-external-link"
              text
              rounded
              aria-label="预览"
              title="预览"
            /><Button
              icon="pi pi-trash"
              text
              rounded
              severity="danger"
              :aria-label="trash ? '永久删除' : '删除'"
              :title="trash ? '永久删除' : '删除'"
              @click="remove(post)"
            />
          </div>
        </div></article
    ></template>
  </ResponsiveDataTable>
</template>
