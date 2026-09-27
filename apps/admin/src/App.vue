<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { ApiError, http, onUnauthorized } from "./api/http";

type Session = { authenticated: boolean; adminName?: string | null };
type Post = { id: string; title: string; slug: string; status: string; updatedAt: string; viewCount: number };
type Paged<T> = { items: T[]; page: number; pageSize: number; totalItems: number; totalPages: number };

const session = ref<Session | null>(null);
const password = ref("");
const posts = ref<Paged<Post> | null>(null);
const loading = ref(false);
const error = ref("");
const loginError = ref("");
const query = ref("");
const authenticated = computed(() => session.value?.authenticated === true);

onUnauthorized(() => {
  session.value = { authenticated: false };
  posts.value = null;
});

async function loadSession(): Promise<void> {
  try {
    session.value = await http.get<Session>("/api/admin/session");
    if (session.value.authenticated) await loadPosts();
  } catch (e) {
    session.value = { authenticated: false };
    if (!(e instanceof ApiError && e.status === 401)) error.value = "无法连接到服务器";
  }
}

async function login(): Promise<void> {
  loginError.value = "";
  try {
    session.value = await http.post<Session>("/api/admin/login", { password: password.value }, { skipAuthRedirect: true });
    password.value = "";
    await loadPosts();
  } catch (e) {
    loginError.value = e instanceof ApiError ? e.detail ?? e.title : "登录失败";
  }
}

async function logout(): Promise<void> {
  await http.post<void>("/api/admin/logout");
  session.value = { authenticated: false };
  posts.value = null;
}

async function loadPosts(): Promise<void> {
  loading.value = true;
  error.value = "";
  try {
    posts.value = await http.get<Paged<Post>>("/api/admin/posts", { q: query.value, page: 1, pageSize: 20 });
  } catch (e) {
    error.value = e instanceof ApiError ? e.detail ?? e.title : "加载文章失败";
  } finally {
    loading.value = false;
  }
}

onMounted(loadSession);
</script>

<template>
  <main class="shell">
    <section v-if="!authenticated" class="login-card">
      <div class="brand-mark">C</div>
      <h1>CashewBlog</h1>
      <p class="muted">管理员登录</p>
      <form @submit.prevent="login">
        <label for="password">密码</label>
        <input id="password" v-model="password" type="password" autocomplete="current-password" required />
        <p v-if="loginError" class="error">{{ loginError }}</p>
        <button type="submit">登录</button>
      </form>
    </section>

    <template v-else>
      <header class="topbar">
        <div><strong>CashewBlog</strong><span class="muted">管理后台</span></div>
        <button class="secondary" @click="logout">退出登录</button>
      </header>
      <section class="content">
        <div class="heading-row"><div><h1>文章</h1><p class="muted">管理已发布和草稿内容</p></div><button>写文章</button></div>
        <form class="search" @submit.prevent="loadPosts"><input v-model="query" placeholder="搜索标题或 slug" /><button class="secondary" type="submit">搜索</button></form>
        <p v-if="error" class="error">{{ error }}</p>
        <div class="card">
          <p v-if="loading" class="muted">加载中…</p>
          <p v-else-if="!posts?.items.length" class="muted empty">还没有文章</p>
          <table v-else><thead><tr><th>标题</th><th>状态</th><th>更新时间</th><th>阅读</th></tr></thead><tbody><tr v-for="post in posts.items" :key="post.id"><td><strong>{{ post.title || "无标题" }}</strong><small>{{ post.slug }}</small></td><td><span class="status">{{ post.status }}</span></td><td>{{ new Date(post.updatedAt).toLocaleString("zh-CN") }}</td><td>{{ post.viewCount }}</td></tr></tbody></table>
        </div>
      </section>
    </template>
  </main>
</template>
