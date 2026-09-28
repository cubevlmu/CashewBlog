<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { useConfirm } from "primevue/useconfirm";
import type { DataTablePageEvent } from "primevue/datatable";
import type {
  AdminPostListItemDto,
  AdminCategoryDto,
  AdminTagDto,
  Paged,
} from "../api/types";
import { http } from "../api/http";
import { attempt, statuses, statusLabel, dateLabel } from "../state";
const props = defineProps<{ trash?: boolean }>();
const router = useRouter(),
  confirm = useConfirm();
const data = ref<Paged<AdminPostListItemDto>>(),
  selected = ref<AdminPostListItemDto[]>([]);
const categories = ref<AdminCategoryDto[]>([]),
  tags = ref<AdminTagDto[]>([]);
const q = ref(""),
  status = ref<string>(),
  categoryId = ref<string>(),
  tagId = ref<string>();
const page = ref(1),
  rows = ref(20),
  busy = ref(false);
async function load(reset = false) {
  if (reset) page.value = 1;
  busy.value = true;
  await attempt(async () => {
    data.value = await http.get("/api/admin/posts", {
      page: page.value,
      pageSize: rows.value,
      q: q.value,
      status: status.value,
      categoryId: categoryId.value,
      tagId: tagId.value,
      trash: props.trash,
    });
    selected.value = [];
  });
  busy.value = false;
}
function paginate(event: DataTablePageEvent) {
  page.value = event.page + 1;
  rows.value = event.rows;
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
  <Panel :header="trash ? '回收站' : '文章'">
    <Toolbar
      ><template #start
        ><form @submit.prevent="load(true)">
          <InputText
            v-model="q"
            placeholder="搜索标题或 slug"
            aria-label="搜索文章"
          /><Select
            v-model="status"
            :options="statuses"
            option-label="label"
            option-value="value"
            placeholder="全部状态"
            show-clear
          /><Select
            v-model="categoryId"
            :options="categories"
            option-label="name"
            option-value="id"
            placeholder="全部分类"
            show-clear
          /><Select
            v-model="tagId"
            :options="tags"
            option-label="name"
            option-value="id"
            placeholder="全部标签"
            show-clear
          /><Button type="submit" label="搜索" /></form></template
      ><template #end
        ><Button
          v-if="!trash"
          label="新建文章"
          icon="pi pi-plus"
          @click="router.push('/admin/posts/new')" /><Button
          v-if="!trash"
          label="批量删除"
          severity="danger"
          :disabled="!selected.length"
          @click="remove()" /></template
    ></Toolbar>
    <DataTable
      v-model:selection="selected"
      :value="data?.items ?? []"
      data-key="id"
      lazy
      paginator
      :first="(page - 1) * rows"
      :rows="rows"
      :rows-per-page-options="[10, 20, 50]"
      :total-records="data?.totalItems ?? 0"
      :loading="busy"
      @page="paginate"
    >
      <template #empty>暂无文章</template
      ><Column v-if="!trash" selection-mode="multiple" /><Column header="封面"
        ><template #body="{ data: post }"
          ><Image
            v-if="post.cover"
            :src="post.cover.thumbUrl"
            alt=""
            width="64" /></template
      ></Column>
      <Column field="title" header="标题"
        ><template #body="{ data: post }"
          ><Button
            :label="post.title"
            text
            :disabled="trash"
            @click="router.push(`/admin/posts/${post.id}`)" /><Tag
            v-if="post.hasWorkingCopy"
            value="有未发布修改"
            severity="warn" /></template
      ></Column>
      <Column header="状态"
        ><template #body="{ data: post }"
          ><Tag
            :value="statusLabel(post.status)"
            :severity="
              post.status === 'published' ? 'success' : 'warn'
            " /></template></Column
      ><Column field="category.name" header="分类" /><Column header="标签"
        ><template #body="{ data: post }">{{
          post.tags.map((tag: AdminTagDto) => tag.name).join("、")
        }}</template></Column
      ><Column header="发布时间"
        ><template #body="{ data: post }">{{
          dateLabel(post.publishedAt)
        }}</template></Column
      ><Column header="更新时间"
        ><template #body="{ data: post }">{{
          dateLabel(post.updatedAt)
        }}</template></Column
      ><Column field="viewCount" header="阅读" />
      <Column header="操作"
        ><template #body="{ data: post }"
          ><Button
            v-if="trash"
            label="恢复"
            text
            @click="restore(post.id)" /><Button
            v-else
            as="a"
            :href="`/posts/${encodeURIComponent(post.slug)}?preview=true`"
            target="_blank"
            rel="noopener"
            label="预览"
            text /><Button
            :label="trash ? '永久删除' : '删除'"
            text
            severity="danger"
            @click="remove(post)" /></template
      ></Column>
    </DataTable>
  </Panel>
</template>
