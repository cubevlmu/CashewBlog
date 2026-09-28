<script setup lang="ts">
import Avatar from "primevue/avatar";
import Menu from "primevue/menu";
import { ref } from "vue";
import { useRoute } from "vue-router";
import { groups, currentNavigation } from "../navigation";

defineProps<{ collapsed?: boolean }>();
const emit = defineEmits<{ navigate: [path: string]; logout: [] }>();
const route = useRoute();
const userMenu = ref<InstanceType<typeof Menu>>();
const userItems = [
  {
    label: "站点设置",
    icon: "pi pi-cog",
    command: () => emit("navigate", "/admin/settings"),
  },
  { separator: true },
  { label: "退出登录", icon: "pi pi-sign-out", command: () => emit("logout") },
];
</script>
<template>
  <div class="flex h-full min-h-0 flex-col">
    <div
      class="flex h-16 shrink-0 items-center gap-3 border-b border-[var(--p-content-border-color)] px-5"
    >
      <Avatar
        icon="pi pi-sparkles"
        class="shrink-0 bg-[var(--p-primary-50)] text-[var(--p-primary-600)]"
      />
      <div v-if="!collapsed" class="min-w-0">
        <p class="text-sm font-bold tracking-wide">CashewBlog</p>
        <p class="text-xs text-[var(--p-text-muted-color)]">内容管理工作台</p>
      </div>
    </div>
    <nav
      class="min-h-0 flex-1 space-y-6 overflow-y-auto px-3 py-5"
      aria-label="后台导航"
    >
      <section v-for="group in groups" :key="group.label" class="space-y-1">
        <p
          v-if="!collapsed"
          class="mb-2 px-3 text-xs font-medium text-[var(--p-text-muted-color)]"
        >
          {{ group.label }}
        </p>
        <Button
          v-for="item in group.items"
          :key="item.path"
          :icon="item.icon"
          :label="collapsed ? undefined : item.label"
          :title="item.label"
          :aria-label="item.label"
          :aria-current="
            currentNavigation(route.path).path === item.path
              ? 'page'
              : undefined
          "
          :severity="
            currentNavigation(route.path).path === item.path
              ? 'primary'
              : 'secondary'
          "
          :text="currentNavigation(route.path).path !== item.path"
          :class="[
            'w-full !py-2.5 !text-sm',
            collapsed ? '!justify-center' : '!justify-start',
          ]"
          @click="emit('navigate', item.path)"
        />
      </section>
    </nav>
    <div class="shrink-0 border-t border-[var(--p-content-border-color)] p-3">
      <Button
        text
        severity="secondary"
        class="w-full !justify-start !px-2"
        aria-label="管理员菜单"
        aria-haspopup="true"
        aria-controls="admin-account-menu"
        @click="userMenu?.toggle($event)"
      >
        <Avatar icon="pi pi-user" shape="circle" class="shrink-0" /><span
          v-if="!collapsed"
          class="min-w-0 flex-1 text-left"
          ><span class="block text-sm font-medium">管理员</span
          ><span class="block text-xs text-[var(--p-text-muted-color)]"
            >个人站点</span
          ></span
        ><i v-if="!collapsed" class="pi pi-chevron-down text-xs" />
      </Button>
      <Menu id="admin-account-menu" ref="userMenu" :model="userItems" popup />
    </div>
  </div>
</template>
