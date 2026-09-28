<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useRouter } from "vue-router";
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
  <Panel header="自定义页面"
    ><Toolbar
      ><template #end
        ><Button
          label="新建页面"
          icon="pi pi-plus"
          @click="router.push('/admin/pages/new')" /></template></Toolbar
    ><DataTable :value="pages"
      ><Column field="title" header="标题" /><Column
        field="slug"
        header="Slug" /><Column field="layout" header="布局" /><Column
        field="updatedAt"
        header="更新时间"
        ><template #body="{ data }">{{
          dateLabel(data.updatedAt)
        }}</template></Column
      ><Column header="操作"
        ><template #body="{ data }"
          ><Button
            label="编辑"
            text
            @click="
              router.push(`/admin/pages/${data.id}`)
            " /></template></Column></DataTable
  ></Panel>
</template>
