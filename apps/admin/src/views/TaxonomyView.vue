<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import { useRoute } from "vue-router";
import { useConfirm } from "primevue/useconfirm";
import type { PageState } from "primevue/paginator";
import ResponsiveDataTable from "../components/ResponsiveDataTable.vue";
import type {
  AdminCategoryDto,
  AdminTagDto,
  AdminSeriesDto,
  AdminSeriesDetailDto,
} from "../api/types";
import { http } from "../api/http";
import { attempt } from "../state";
const route = useRoute(),
  confirm = useConfirm();
const kind = computed(() => String(route.params.kind));
type Term = AdminCategoryDto | AdminTagDto | AdminSeriesDto;
const termName = (item: Term) => ("title" in item ? item.title : item.name);
const items = ref<Term[]>([]),
  categories = ref<AdminCategoryDto[]>([]),
  busy = ref(false),
  visible = ref(false),
  editing = ref<string>();
const page = ref(1);
function paginate(event: PageState) {
  page.value = event.page + 1;
}
const model = reactive({
  name: "",
  title: "",
  slug: "",
  description: "",
  status: "ongoing",
  defaultCategoryId: null as string | null,
});
const ordered = ref<AdminSeriesDetailDto["posts"]>([]),
  orderVisible = ref(false),
  orderId = ref("");
async function load() {
  busy.value = true;
  await attempt(async () => {
    items.value = await http.get<Term[]>(`/api/admin/${kind.value}`);
  });
  busy.value = false;
}
function edit(item?: Term) {
  editing.value = item?.id;
  Object.assign(
    model,
    {
      name: "",
      title: "",
      slug: "",
      description: "",
      status: "ongoing",
      defaultCategoryId: null,
    },
    item ?? {},
  );
  visible.value = true;
}
async function save() {
  busy.value = true;
  await attempt(async () => {
    const body =
      kind.value === "series"
        ? {
            title: model.title,
            slug: model.slug,
            description: model.description,
            status: model.status,
            defaultCategoryId: model.defaultCategoryId,
          }
        : {
            name: model.name,
            slug: model.slug,
            ...(kind.value === "categories"
              ? { description: model.description }
              : {}),
          };
    if (editing.value)
      await http.put(`/api/admin/${kind.value}/${editing.value}`, body);
    else await http.post(`/api/admin/${kind.value}`, body);
    visible.value = false;
    await load();
  });
  busy.value = false;
}
function remove(item: Term) {
  confirm.require({
    header: "删除",
    message: "删除此分类、标签或系列后，文章仍会保留。确定删除？",
    acceptLabel: "删除",
    rejectLabel: "取消",
    accept: () =>
      attempt(async () => {
        await http.del(`/api/admin/${kind.value}/${item.id}`);
        await load();
      }),
  });
}
async function reorder(item: Term) {
  await attempt(async () => {
    ordered.value = (
      await http.get<AdminSeriesDetailDto>(`/api/admin/series/${item.id}`)
    ).posts;
    orderId.value = item.id;
    orderVisible.value = true;
  });
}
async function saveOrder() {
  await attempt(async () => {
    await http.put(`/api/admin/series/${orderId.value}/order`, {
      postIds: ordered.value.map((p) => p.id),
    });
    orderVisible.value = false;
  });
}
onMounted(async () => {
  await load();
  if (kind.value === "series")
    await attempt(async () => {
      categories.value = await http.get<AdminCategoryDto[]>(
        "/api/admin/categories",
      );
    });
});
</script>
<template>
  <ResponsiveDataTable
    :value="items"
    :loading="busy"
    :lazy="false"
    :empty-text="`暂无${kind === 'categories' ? '分类' : kind === 'tags' ? '标签' : '系列'}`"
    table-style="min-width: 44rem"
    :page="page"
    :total-records="items.length"
    @page="paginate"
  >
    <template #actions
      ><Button
        icon="pi pi-plus"
        aria-label="新建"
        title="新建"
        @click="edit()"
    /></template>
    <Column header="名称"
        ><template #body="{ data }"
          ><span class="font-medium">{{ termName(data) }}</span></template
      ></Column>
      <Column header="Slug"
        ><template #body="{ data }"
          ><span class="font-mono text-xs text-[var(--p-text-muted-color)]">{{
            data.slug
          }}</span></template
      ></Column>
      <Column header="文章数"
        ><template #body="{ data }"
          ><Tag :value="`${data.postCount} 篇`" severity="secondary" /></template
      ></Column>
      <Column header="操作"
        ><template #body="{ data }"
          ><div class="flex justify-end gap-0.5">
            <Button
              icon="pi pi-pencil"
              text
              rounded
              aria-label="编辑"
              title="编辑"
              @click="edit(data)" /><Button
              v-if="kind === 'series'"
              icon="pi pi-sort-alt"
              text
              rounded
              aria-label="文章排序"
              title="文章排序"
              @click="reorder(data)" /><Button
              icon="pi pi-trash"
              text
              rounded
              severity="danger"
              aria-label="删除"
              title="删除"
              @click="remove(data)"
            /></div></template
      ></Column>
    <template #item="{ item: data }"
      ><article class="flex items-start justify-between gap-3 p-4">
        <div class="min-w-0 space-y-1.5">
          <p class="font-medium">{{ termName(data) }}</p>
          <p class="truncate font-mono text-xs text-[var(--p-text-muted-color)]">
            {{ data.slug }}
          </p>
          <Tag :value="`${data.postCount} 篇`" severity="secondary" />
        </div>
        <div class="flex shrink-0 gap-0.5">
          <Button
            icon="pi pi-pencil"
            text
            rounded
            aria-label="编辑"
            title="编辑"
            @click="edit(data)" /><Button
            v-if="kind === 'series'"
            icon="pi pi-sort-alt"
            text
            rounded
            aria-label="文章排序"
            title="文章排序"
            @click="reorder(data)" /><Button
            icon="pi pi-trash"
            text
            rounded
            severity="danger"
            aria-label="删除"
            title="删除"
            @click="remove(data)"
          />
        </div>
      </article></template
    >
  </ResponsiveDataTable>
  <Dialog v-model:visible="visible" modal header="编辑内容">
    <Fluid
      ><form @submit.prevent="save">
        <Field v-if="kind === 'series'" label="标题"
          ><InputText v-model="model.title" required
        /></Field>
        <Field v-else label="名称"
          ><InputText v-model="model.name" required
        /></Field>
        <Field label="Slug"><InputText v-model="model.slug" /></Field>
        <Field v-if="kind !== 'tags'" label="描述"
          ><Textarea v-model="model.description" auto-resize
        /></Field>
        <Field v-if="kind === 'series'" label="状态"
          ><Select
            v-model="model.status"
            :options="[
              { label: '连载中', value: 'ongoing' },
              { label: '已完结', value: 'completed' },
            ]"
            option-label="label"
            option-value="value"
        /></Field>
        <Field v-if="kind === 'series'" label="默认分类"
          ><Select
            v-model="model.defaultCategoryId"
            :options="categories"
            option-label="name"
            option-value="id"
            show-clear
        /></Field>
        <Button type="submit" label="保存" :loading="busy" /></form
    ></Fluid>
  </Dialog>
  <Dialog v-model:visible="orderVisible" modal header="系列文章顺序"
    ><OrderList v-model="ordered" data-key="id"
      ><template #option="{ option }">{{ option.title }}</template></OrderList
    ><Button label="保存顺序" @click="saveOrder"
  /></Dialog>
</template>
