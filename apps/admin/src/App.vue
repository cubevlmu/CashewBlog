<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useRoute } from "vue-router";
import Drawer from "primevue/drawer";
import AdminNavigation from "./components/AdminNavigation.vue";
import { currentNavigation } from "./navigation";
import { dark, toggleTheme } from "./theme";
import { router } from "./router";
import { http } from "./api/http";
import { attempt, failure, session } from "./state";
const route = useRoute();
const collapsed = ref(
    localStorage.getItem("cashew-admin-collapsed") === "true",
  ),
  mobileOpen = ref(false);
const showMenu = computed(
  () =>
    session.value?.authenticated &&
    !["/setup", "/admin/setup"].includes(route.path),
);
const active = computed(() => currentNavigation(route.path));
watch(collapsed, (value) =>
  localStorage.setItem("cashew-admin-collapsed", String(value)),
);
async function navigate(path: string) {
  await router.push(path);
  mobileOpen.value = false;
}
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
  <div
    v-if="showMenu"
    class="flex h-dvh overflow-hidden bg-slate-50 font-sans text-[var(--p-text-color)] dark:bg-zinc-950"
  >
    <aside
      :class="[
        'hidden h-full shrink-0 border-r border-[var(--p-content-border-color)] bg-[var(--p-content-background)] transition-[width] lg:block',
        collapsed ? 'w-20' : 'w-64',
      ]"
    >
      <AdminNavigation
        :collapsed="collapsed"
        @navigate="navigate"
        @logout="logout"
      />
    </aside>
    <Drawer
      v-model:visible="mobileOpen"
      header="导航"
      class="!w-72"
      :pt="{ content: { class: '!p-0' } }"
      ><AdminNavigation @navigate="navigate" @logout="logout"
    /></Drawer>
    <div class="flex min-w-0 flex-1 flex-col">
      <Toolbar
        class="!h-16 !shrink-0 !rounded-none !border-x-0 !border-t-0 !px-4 sm:!px-7"
      >
        <template #start
          ><div class="flex items-center gap-3">
            <Button
              icon="pi pi-bars"
              text
              severity="secondary"
              class="lg:!hidden"
              aria-label="打开导航"
              @click="mobileOpen = true"
            /><Button
              :icon="
                collapsed
                  ? 'pi pi-angle-double-right'
                  : 'pi pi-angle-double-left'
              "
              text
              severity="secondary"
              class="!hidden lg:!inline-flex"
              aria-label="折叠侧栏"
              @click="collapsed = !collapsed"
            /><span class="text-sm font-semibold">{{ active.label }}</span>
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
            /></div
        ></template>
      </Toolbar>
      <div class="min-h-0 flex-1 overflow-y-auto">
        <main
          class="mx-auto w-full max-w-[1480px] space-y-6 px-4 pt-6 pb-10 sm:px-7"
        >
          <header class="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p
                class="mb-1 text-xs font-medium uppercase tracking-widest text-[var(--p-text-muted-color)]"
              >
                CashewBlog / 工作台
              </p>
              <h1 class="text-2xl font-semibold tracking-tight sm:text-3xl">
                {{ active.label }}
              </h1>
              <p class="mt-2 text-sm text-[var(--p-text-muted-color)]">
                {{ active.description }}
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
    </div>
  </div>
  <main
    v-else
    class="flex min-h-dvh items-center justify-center bg-slate-50 p-4 font-sans text-[var(--p-text-color)] dark:bg-zinc-950 sm:p-8"
  >
    <div
      :class="[
        'w-full space-y-4',
        route.path.includes('setup') ? 'max-w-3xl' : 'max-w-md',
      ]"
    >
      <Message v-if="failure" severity="error" closable @close="failure = ''">{{
        failure
      }}</Message
      ><RouterView :key="route.path" />
    </div>
  </main>
</template>
