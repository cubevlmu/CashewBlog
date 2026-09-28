import { createRouter, createWebHistory } from "vue-router";
import { http } from "./api/http";
import { session, setup, errorMessage, failure } from "./state";
import type { SessionDto, SetupStatusDto } from "./api/types";

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: "/setup",
      alias: "/admin/setup",
      component: () => import("./views/SetupView.vue"),
    },
    { path: "/admin/login", component: () => import("./views/LoginView.vue") },
    { path: "/admin", component: () => import("./views/DashboardView.vue") },
    { path: "/admin/posts", component: () => import("./views/PostsView.vue") },
    {
      path: "/admin/trash",
      component: () => import("./views/PostsView.vue"),
      props: { trash: true },
    },
    {
      path: "/admin/posts/:id",
      component: () => import("./views/PostEditorView.vue"),
      meta: { bare: true },
    },
    {
      path: "/admin/:kind(categories|tags|series)",
      component: () => import("./views/TaxonomyView.vue"),
    },
    { path: "/admin/pages", component: () => import("./views/PagesView.vue") },
    {
      path: "/admin/pages/:id",
      component: () => import("./views/PageEditorView.vue"),
      meta: { bare: true },
    },
    { path: "/admin/media", component: () => import("./views/MediaView.vue") },
    {
      path: "/admin/analytics",
      component: () => import("./views/AnalyticsView.vue"),
    },
    {
      path: "/admin/settings",
      redirect: "/admin/settings/general",
    },
    {
      path: "/admin/settings/security",
      component: () => import("./views/SecurityView.vue"),
    },
    {
      path: "/admin/settings/:section",
      component: () => import("./views/SettingsView.vue"),
    },
    { path: "/:pathMatch(.*)*", redirect: "/admin" },
  ],
});

router.beforeEach(async (to) => {
  try {
    setup.value ??= await http.get<SetupStatusDto>("/api/setup/status");
    const setupPath = import.meta.env.DEV ? "/admin/setup" : "/setup";
    if (setup.value.setupRequired)
      return ["/setup", "/admin/setup"].includes(to.path) ? true : setupPath;
    if (["/setup", "/admin/setup"].includes(to.path)) return "/admin/login";
    session.value ??= await http.get<SessionDto>("/api/admin/session");
    if (!session.value.authenticated && to.path !== "/admin/login")
      return { path: "/admin/login", query: { next: to.fullPath } };
    if (session.value.authenticated && to.path === "/admin/login")
      return "/admin";
    return true;
  } catch (error) {
    failure.value = errorMessage(error);
    return to.path === "/admin/login" ? true : "/admin/login";
  }
});
