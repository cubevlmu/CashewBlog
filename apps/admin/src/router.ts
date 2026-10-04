import { createRouter, createWebHistory } from "vue-router";
import { http } from "./api/http";
import { session, setup, errorMessage, failure } from "./state";
import type { SessionDto, SetupStatusDto } from "./api/types";
import { goToEntrance, isEntrancePath } from "./entrance";

const LoginView = () => import("./views/LoginView.vue");

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: "/setup",
      alias: "/admin/setup",
      component: () => import("./views/SetupView.vue"),
    },
    { path: "/admin/login", component: LoginView, meta: { login: true } },
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
      path: "/admin/security-alerts",
      component: () => import("./views/SecurityAlertsView.vue"),
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
    // The server only serves the SPA on the configured entrance, so any single segment it hands us is it.
    {
      path: "/:entrance([A-Za-z0-9_-]{4,64})",
      component: LoginView,
      meta: { login: true },
      beforeEnter: (to) => isEntrancePath(to.path) || "/admin",
    },
    { path: "/:pathMatch(.*)*", redirect: "/admin" },
  ],
});

router.beforeEach(async (to) => {
  const isLogin = to.meta.login === true;
  try {
    setup.value ??= await http.get<SetupStatusDto>("/api/setup/status");
    const setupPath = import.meta.env.DEV ? "/admin/setup" : "/setup";
    if (setup.value.setupRequired)
      return ["/setup", "/admin/setup"].includes(to.path) ? true : setupPath;
    if (["/setup", "/admin/setup"].includes(to.path)) return "/admin";
    session.value ??= await http.get<SessionDto>("/api/admin/session");
    if (session.value.authenticated) return isLogin ? "/admin" : true;
    if (isLogin) return true;
    // Signed out inside the admin: back to the entrance with a page load (it sets the entrance cookie).
    goToEntrance(to.fullPath);
    return false;
  } catch (error) {
    failure.value = errorMessage(error);
    return isLogin;
  }
});
