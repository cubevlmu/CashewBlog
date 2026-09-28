<script setup lang="ts">
import Avatar from "primevue/avatar";
import Menu from "primevue/menu";
import { ref } from "vue";
import { useRoute } from "vue-router";
import { groups, currentNavigation } from "../navigation";
import type { NavigationItem } from "../navigation";

const emit = defineEmits<{ navigate: [path: string]; logout: [] }>();
const route = useRoute();
const logoSrc = `${import.meta.env.BASE_URL}cashew_logo.png`;
const userMenu = ref<InstanceType<typeof Menu>>();
const userItems = [
  {
    label: "站点设置",
    icon: "pi pi-cog",
    command: () => emit("navigate", "/admin/settings/general"),
  },
  { separator: true },
  { label: "退出登录", icon: "pi pi-sign-out", command: () => emit("logout") },
];
const openMenus = ref<Record<string, boolean>>({});
const isActive = (item: NavigationItem) =>
  currentNavigation(route.path).path === item.path;
/**
 * Parent menus follow the route: a menu with the active page inside opens on load and on
 * navigation. Toggling the menu takes over until the next mount, so a manual collapse is
 * not undone by moving between its pages.
 */
const menuOpen = (item: NavigationItem) =>
  openMenus.value[item.path] ??
  Boolean(item.children?.some((child) => child.path === route.path));
</script>
<template>
  <SidebarHeader>
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton as="div" class="!p-2"
          ><img
            :src="logoSrc"
            alt=""
            class="size-8 shrink-0 rounded-md object-contain"
          ><span class="min-w-0 leading-tight"
            ><span class="block truncate text-sm font-bold tracking-wide"
              >CashewBlog</span
            ><span
              class="block truncate text-xs text-[var(--p-text-muted-color)]"
              >内容管理工作台</span
            ></span
          ></SidebarMenuButton
        >
      </SidebarMenuItem>
    </SidebarMenu>
  </SidebarHeader>
  <SidebarContent aria-label="侧边栏导航内容">
    <SidebarGroup v-for="group in groups" :key="group.label" :aria-label="`${group.label}导航分组`">
      <SidebarGroupLabel>{{ group.label }}</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu :aria-label="`${group.label}菜单`">
          <SidebarMenuItem
            v-for="item in group.items"
            :key="item.path"
            :collapsible="Boolean(item.children?.length)"
            :open="menuOpen(item)"
            @update:open="(value) => (openMenus[item.path] = value)"
          >
            <SidebarMenuButton
              :is-active="isActive(item)"
              :title="item.label"
              :aria-current="isActive(item) ? 'page' : undefined"
              @click="emit('navigate', item.path)"
            >
              <i :class="item.icon" aria-hidden="true" /><span>{{
                item.label
              }}</span
              ><i
                v-if="item.children?.length"
                class="pi pi-chevron-down ml-auto text-xs"
                aria-hidden="true"
              />
            </SidebarMenuButton>
            <SidebarMenuSub v-if="item.children?.length" :aria-label="`${item.label}子菜单`">
              <SidebarMenuSubItem
                v-for="child in item.children"
                :key="child.path"
              >
                <SidebarMenuSubButton
                  :is-active="route.path === child.path"
                  :aria-current="route.path === child.path ? 'page' : undefined"
                  @click="emit('navigate', child.path)"
                >
                  <i
                    v-if="child.icon"
                    :class="[child.icon, 'shrink-0']"
                    aria-hidden="true"
                  />
                  <span>{{ child.label }}</span>
                </SidebarMenuSubButton>
              </SidebarMenuSubItem>
            </SidebarMenuSub>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  </SidebarContent>
  <SidebarFooter>
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton
          class="!p-2"
          aria-haspopup="true"
          aria-controls="admin-account-menu"
          @click="userMenu?.toggle($event)"
        >
          <Avatar
            icon="pi pi-user"
            shape="circle"
            class="size-7 shrink-0 text-sm"
          /><span class="min-w-0 text-left leading-tight"
            ><span class="block truncate text-sm font-medium">管理员</span
            ><span
              class="block truncate text-xs text-[var(--p-text-muted-color)]"
              >个人站点</span
            ></span
          ><i class="pi pi-chevron-down ml-auto text-xs" aria-hidden="true"
        /></SidebarMenuButton>
        <Menu id="admin-account-menu" ref="userMenu" :model="userItems" popup />
      </SidebarMenuItem>
    </SidebarMenu>
  </SidebarFooter>
</template>
