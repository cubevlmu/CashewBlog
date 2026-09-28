<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import { useRoute } from "vue-router";
import { useConfirm } from "primevue/useconfirm";
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
const items = ref<Term[]>([]),
  categories = ref<AdminCategoryDto[]>([]),
  busy = ref(false),
  visible = ref(false),
  editing = ref<string>();
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
  <Panel
    :header="kind === 'categories' ? '分类' : kind === 'tags' ? '标签' : '系列'"
  >
    <Toolbar
      ><template #end
        ><Button label="新建" icon="pi pi-plus" @click="edit()" /></template
    ></Toolbar>
    <DataTable :value="items" :loading="busy" paginator :rows="20">
      <template #empty>暂无记录</template>
      <Column
        :field="kind === 'series' ? 'title' : 'name'"
        header="名称"
      /><Column field="slug" header="Slug" /><Column
        field="postCount"
        header="文章数"
      />
      <Column header="操作"
        ><template #body="{ data }"
          ><Button label="编辑" text @click="edit(data)" /><Button
            v-if="kind === 'series'"
            label="文章排序"
            text
            @click="reorder(data)" /><Button
            label="删除"
            text
            severity="danger"
            @click="remove(data)" /></template
      ></Column>
    </DataTable>
  </Panel>
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
