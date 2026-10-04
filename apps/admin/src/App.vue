<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useRoute } from "vue-router";
import AdminNavigation from "./components/AdminNavigation.vue";
import {
  navigationTrail,
  pageDescription,
  pageIcon,
  pageTitle,
} from "./navigation";
import { dark, toggleTheme } from "./theme";
import { router } from "./router";
import { goToEntrance } from "./entrance";
import { http } from "./api/http";
import { attempt, failure, session } from "./state";
import CacheManagementDialog from "./components/CacheManagementDialog.vue";
import { initializeCache } from "./browser-cache";
const route = useRoute();
const mobileQuery = window.matchMedia("(max-width: 1023px)");
const isMobile = ref(mobileQuery.matches),
  open = ref(
    mobileQuery.matches
      ? false
      : localStorage.getItem("cashew-admin-collapsed") !== "true",
  );
const showMenu = computed(
  () =>
    session.value?.authenticated &&
    !["/setup", "/admin/setup"].includes(route.path),
);
const trail = computed(() => navigationTrail(route.path));
const title = computed(() => pageTitle(route.path));
const icon = computed(() => pageIcon(route.path));
const description = computed(() => pageDescription(route.path));
const cacheDialog = ref(false);
const cacheReady = ref(false);
function onMobileChange(event: MediaQueryListEvent) {
  isMobile.value = event.matches;
  open.value = !event.matches;
}
mobileQuery.addEventListener("change", onMobileChange);
onBeforeUnmount(() => mobileQuery.removeEventListener("change", onMobileChange));
onMounted(() => {
  void initializeCache(() => { cacheReady.value = true; });
});
watch(open, (value) => {
  if (!isMobile.value)
    localStorage.setItem("cashew-admin-collapsed", String(!value));
});
async function navigate(path: string) {
  if (isMobile.value) open.value = false;
  await router.push(path);
}
async function logout() {
  await attempt(async () => {
    await http.post("/api/admin/logout");
    session.value = null;
    goToEntrance();
  });
}
</script>
<template>
  <ConfirmDialog />
  <CacheManagementDialog v-model:visible="cacheDialog" />
  <Message v-if="cacheReady" class="fixed right-4 bottom-4 z-50 max-w-sm shadow-lg" severity="success" closable @close="cacheReady = false">
    基础 CSS、JavaScript 和字体已缓存到本机，下次打开会更快。
  </Message>
  <SidebarLayout
    v-if="showMenu"
    class="relative h-dvh overflow-hidden bg-slate-50 font-sans text-[var(--p-text-color)] dark:bg-zinc-950"
  >
    <SidebarBackdrop v-if="isMobile && open" class="!absolute" />
    <Sidebar
      id="admin-sidebar"
      :collapsible="isMobile ? 'offcanvas' : 'icon'"
      :overlay="isMobile"
      v-model:open="open"
    >
      <SidebarSpacer />
      <SidebarAside>
        <SidebarPanel>
          <AdminNavigation :collapsed="!isMobile && !open" @navigate="navigate" @logout="logout" />
          <SidebarRail />
        </SidebarPanel>
      </SidebarAside>
    </Sidebar>
    <SidebarMain class="flex min-h-0 min-w-0 flex-1 flex-col">
      <Toolbar
        class="!h-16 !shrink-0 !rounded-none !border-x-0 !border-t-0 !px-4 sm:!px-7"
      >
        <template #start
          ><div class="flex items-center gap-3">
            <SidebarTrigger
              severity="secondary"
              text
              size="small"
              icon-only
              aria-label="展开或收起侧边栏"
              title="展开或收起侧边栏"
              ><i class="pi pi-bars" /></SidebarTrigger
            ><span class="flex size-8 items-center justify-center rounded-lg bg-[var(--p-primary-100)] text-[var(--p-primary-700)] dark:bg-[var(--p-primary-900)] dark:text-[var(--p-primary-200)]">
              <i :class="icon" aria-hidden="true" />
            </span><span class="text-sm font-semibold">{{ title }}</span>
          </div></template
        >
        <template #end
          ><div class="flex items-center gap-1">
            <Button
              as="a"
              href="/"
              target="_blank"
              rel="noopener"
              icon="pi pi-external-link"
              label="访问站点"
              text
              severity="secondary"
              size="small"
            /><Button
              :icon="dark ? 'pi pi-sun' : 'pi pi-moon'"
              text
              severity="secondary"
              rounded
              aria-label="切换后台明暗模式"
              @click="toggleTheme"
            /><Button
              icon="pi pi-cog"
              text
              severity="secondary"
              rounded
              aria-label="站点设置"
              title="站点设置"
              @click="navigate('/admin/settings/general')"
            /><Button
              icon="pi pi-database"
              text
              severity="secondary"
              rounded
              aria-label="浏览器缓存管理"
              title="浏览器缓存管理"
              @click="cacheDialog = true"
            /></div
        ></template>
      </Toolbar>
      <div class="min-h-0 flex-1 overflow-y-auto">
        <main
          class="mx-auto w-full max-w-[1480px] space-y-6 px-4 pt-6 pb-10 sm:px-7"
        >
          <header
            v-if="!route.meta.bare"
            class="flex flex-wrap items-end justify-between gap-4"
          >
            <div>
              <Breadcrumb
                :model="trail"
                class="mb-1 !bg-transparent !p-0"
                ><template #item="{ item }"
                  ><RouterLink
                    v-if="item.to"
                    :to="item.to"
                    class="text-xs font-medium tracking-widest text-[var(--p-text-muted-color)] transition-colors hover:text-[var(--p-primary-color)]"
                    >{{ item.label }}</RouterLink
                  ><span
                    v-else
                    class="text-xs font-medium tracking-widest text-[var(--p-text-color)]"
                    >{{ item.label }}</span
                  ></template
                ></Breadcrumb
              >
              <h1 class="text-2xl font-semibold tracking-tight sm:text-3xl">
                {{ title }}
              </h1>
              <p class="mt-2 text-sm text-[var(--p-text-muted-color)]">
                {{ description }}
              </p>
            </div>
            <Button
              v-if="route.path === '/admin'"
              label="写文章"
              icon="pi pi-plus"
              @click="navigate('/admin/posts/new')"
            />
          </header>
          <Message
            v-if="failure"
            severity="error"
            closable
            @close="failure = ''"
            >{{ failure }}</Message
          >
          <RouterView :key="route.path" />
        </main>
      </div>
    </SidebarMain>
  </SidebarLayout>
  <RouterView v-else-if="route.meta.login" />
  <main
    v-else
    class="flex min-h-dvh items-center justify-center bg-slate-50 p-4 font-sans text-[var(--p-text-color)] dark:bg-zinc-950 sm:p-8"
  >
    <div
      :class="[
        'w-full space-y-4 max-w-3xl',
      ]"
    >
      <Message v-if="failure" severity="error" closable @close="failure = ''">{{
        failure
      }}</Message
      ><RouterView :key="route.path" />
    </div>
  </main>
</template>
