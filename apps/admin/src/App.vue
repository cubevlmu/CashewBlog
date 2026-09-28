<script setup lang="ts">
import { computed } from "vue";
import { useRoute } from "vue-router";
import { router } from "./router";
import { http } from "./api/http";
import { attempt, failure, session } from "./state";

const route = useRoute();
const showMenu = computed(
  () => session.value?.authenticated && route.path !== "/setup",
);
const link = (label: string, path: string, icon: string) => ({
  label,
  icon: `pi pi-${icon}`,
  command: () => router.push(path),
});
const menu = [
  link("仪表盘", "/admin", "home"),
  {
    label: "内容",
    icon: "pi pi-file-edit",
    items: [
      link("文章", "/admin/posts", "file"),
      link("分类", "/admin/categories", "folder"),
      link("标签", "/admin/tags", "tags"),
      link("系列", "/admin/series", "list"),
      link("自定义页面", "/admin/pages", "code"),
      link("回收站", "/admin/trash", "trash"),
    ],
  },
  link("媒体库", "/admin/media", "images"),
  link("统计", "/admin/analytics", "chart-line"),
  link("设置", "/admin/settings", "cog"),
];
async function logout() {
  await attempt(async () => {
    await http.post("/api/admin/logout");
    session.value = null;
    await router.push("/admin/login");
  });
}
</script>
<template>
  <ConfirmDialog />
  <Menubar v-if="showMenu" :model="menu">
    <template #start><strong>CashewBlog</strong></template>
    <template #end
      ><Button
        as="a"
        href="/"
        label="访问站点"
        icon="pi pi-external-link"
        target="_blank"
        rel="noopener"
        text /><Button label="退出" icon="pi pi-sign-out" text @click="logout"
    /></template>
  </Menubar>
  <Message
    v-if="failure"
    severity="error"
    :closable="true"
    @close="failure = ''"
    >{{ failure }}</Message
  >
  <main><RouterView :key="route.path" /></main>
</template>
