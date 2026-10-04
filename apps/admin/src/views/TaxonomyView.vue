<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import { useRoute } from "vue-router";
import { useConfirm } from "primevue/useconfirm";
import type { PageState } from "primevue/paginator";
import SelectButton from "primevue/selectbutton";
import { VueDraggable } from "vue-draggable-plus";
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
const termLabel = computed(() =>
  kind.value === "categories" ? "分类" : kind.value === "tags" ? "标签" : "系列",
);
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
  <Dialog
    v-model:visible="visible"
    modal
    :draggable="false"
    :header="`${editing ? '编辑' : '新建'}${termLabel}`"
    :style="{ width: 'min(36rem, 96vw)' }"
  >
    <Fluid
      ><form id="term-form" class="flex flex-col gap-5" @submit.prevent="save">
        <div class="flex flex-col gap-1.5">
          <label for="term-name" class="text-sm font-medium">{{ kind === "series" ? "标题" : "名称" }}</label>
          <InputText v-if="kind === 'series'" id="term-name" v-model="model.title" required autofocus />
          <InputText v-else id="term-name" v-model="model.name" required autofocus />
        </div>
        <div class="flex flex-col gap-1.5">
          <label for="term-slug" class="text-sm font-medium">Slug</label>
          <InputText id="term-slug" v-model="model.slug" class="font-mono" placeholder="留空自动生成" />
          <small class="text-[var(--p-text-muted-color)]">
            用于页面地址；留空时根据{{ kind === "series" ? "标题" : "名称" }}自动生成。
          </small>
        </div>
        <div v-if="kind !== 'tags'" class="flex flex-col gap-1.5">
          <label for="term-description" class="text-sm font-medium">描述</label>
          <Textarea id="term-description" v-model="model.description" auto-resize rows="4" placeholder="可选" />
        </div>
        <div v-if="kind === 'series'" class="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <div class="flex flex-col gap-1.5">
            <span id="series-status-label" class="text-sm font-medium">状态</span>
            <SelectButton
              v-model="model.status"
              :options="[
                { label: '连载中', value: 'ongoing' },
                { label: '已完结', value: 'completed' },
              ]"
              option-label="label"
              option-value="value"
              :allow-empty="false"
              aria-labelledby="series-status-label"
            />
          </div>
          <div class="flex flex-col gap-1.5">
            <label for="series-category" class="text-sm font-medium">默认分类</label>
            <Select
              v-model="model.defaultCategoryId"
              input-id="series-category"
              :options="categories"
              option-label="name"
              option-value="id"
              placeholder="不指定"
              show-clear
            />
            <small class="text-[var(--p-text-muted-color)]">系列中没有自己分类的文章使用该分类。</small>
          </div>
        </div>
      </form></Fluid
    >
    <template #footer>
      <Button label="取消" text severity="secondary" @click="visible = false" />
      <Button type="submit" form="term-form" label="保存" icon="pi pi-check" :loading="busy" />
    </template>
  </Dialog>
  <Dialog
    v-model:visible="orderVisible"
    modal
    :draggable="false"
    header="系列文章顺序"
    :style="{ width: 'min(40rem, 96vw)' }"
  >
    <p class="mt-0 mb-3 text-sm text-[var(--p-text-muted-color)]">拖动调整文章在系列中的阅读顺序。</p>
    <VueDraggable
      v-if="ordered.length"
      v-model="ordered"
      handle=".drag-handle"
      class="max-h-[60dvh] divide-y divide-[var(--p-content-border-color)] overflow-y-auto rounded-lg border border-[var(--p-content-border-color)]"
    >
      <div v-for="(post, index) in ordered" :key="post.id" class="flex items-center gap-3 px-3 py-2">
        <Button class="drag-handle shrink-0 cursor-grab" icon="pi pi-bars" text severity="secondary" aria-label="拖动排序" title="拖动排序" />
        <span class="w-6 shrink-0 text-right font-mono text-sm text-[var(--p-text-muted-color)]">{{ index + 1 }}</span>
        <span class="min-w-0 flex-1 truncate text-sm">{{ post.title }}</span>
      </div>
    </VueDraggable>
    <p v-else class="m-0 rounded-lg border border-dashed border-[var(--p-content-border-color)] px-4 py-6 text-center text-sm text-[var(--p-text-muted-color)]">
      该系列还没有文章。
    </p>
    <template #footer>
      <Button label="取消" text severity="secondary" @click="orderVisible = false" />
      <Button label="保存顺序" icon="pi pi-check" :disabled="!ordered.length" @click="saveOrder" />
    </template>
  </Dialog>
</template>
