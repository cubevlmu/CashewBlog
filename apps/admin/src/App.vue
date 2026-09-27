<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import Button from "primevue/button";
import Card from "primevue/card";
import Column from "primevue/column";
import DataTable from "primevue/datatable";
import InputText from "primevue/inputtext";
import Message from "primevue/message";
import Password from "primevue/password";
import Tag from "primevue/tag";
import Toolbar from "primevue/toolbar";
import { ApiError, http, onUnauthorized } from "./api/http";

type Session = { authenticated: boolean; adminName?: string | null };
type Post = { id: string; title: string; slug: string; status: string; updatedAt: string; viewCount: number };
type Paged<T> = { items: T[]; page: number; pageSize: number; totalItems: number; totalPages: number };
const session = ref<Session | null>(null), password = ref(""), posts = ref<Paged<Post> | null>(null);
const loading = ref(false), error = ref(""), loginError = ref(""), query = ref("");
const authenticated = computed(() => session.value?.authenticated === true);
onUnauthorized(() => { session.value = { authenticated: false }; posts.value = null; });
async function loadSession(): Promise<void> { try { session.value = await http.get<Session>("/api/admin/session"); if (session.value.authenticated) await loadPosts(); } catch (e) { session.value = { authenticated: false }; if (!(e instanceof ApiError && e.status === 401)) error.value = "无法连接到服务器"; } }
async function login(): Promise<void> { loginError.value = ""; try { session.value = await http.post<Session>("/api/admin/login", { password: password.value }, { skipAuthRedirect: true }); password.value = ""; await loadPosts(); } catch (e) { loginError.value = e instanceof ApiError ? e.detail ?? e.title : "登录失败"; } }
async function logout(): Promise<void> { await http.post<void>("/api/admin/logout"); session.value = { authenticated: false }; posts.value = null; }
async function loadPosts(): Promise<void> { loading.value = true; error.value = ""; try { posts.value = await http.get<Paged<Post>>("/api/admin/posts", { q: query.value, page: 1, pageSize: 20 }); } catch (e) { error.value = e instanceof ApiError ? e.detail ?? e.title : "加载文章失败"; } finally { loading.value = false; } }
function statusSeverity(status: string): "success" | "warn" | "secondary" | "danger" { return status === "published" ? "success" : status === "private" ? "danger" : status === "draft" ? "warn" : "secondary"; }
onMounted(loadSession);
</script>
<template>
  <div v-if="!authenticated" class="login-page"><Card class="login-card"><template #title>CashewBlog</template><template #subtitle>管理员登录</template><template #content><form @submit.prevent="login"><label for="password">密码</label><Password id="password" v-model="password" :feedback="false" toggle-mask fluid required autocomplete="current-password" /><Message v-if="loginError" severity="error" :closable="false">{{ loginError }}</Message><Button type="submit" label="登录" icon="pi pi-sign-in" /></form></template></Card></div>
  <div v-else class="admin-page"><Toolbar><template #start><span class="brand"><i class="pi pi-box" /> CashewBlog <small>管理后台</small></span></template><template #end><Button label="退出登录" icon="pi pi-sign-out" severity="secondary" text @click="logout" /></template></Toolbar><main><div class="page-heading"><div><h1>文章</h1><p>管理已发布和草稿内容</p></div><Button label="写文章" icon="pi pi-plus" /></div><form class="search-row" @submit.prevent="loadPosts"><InputText v-model="query" placeholder="搜索标题或 slug" /><Button type="submit" label="搜索" icon="pi pi-search" severity="secondary" /></form><Message v-if="error" severity="error" :closable="false">{{ error }}</Message><DataTable :value="posts?.items ?? []" :loading="loading" striped-rows paginator :rows="20" responsive-layout="scroll"><template #empty>还没有文章</template><Column field="title" header="标题"><template #body="{ data }"><strong>{{ data.title || "无标题" }}</strong><small class="slug">{{ data.slug }}</small></template></Column><Column field="status" header="状态"><template #body="{ data }"><Tag :value="data.status" :severity="statusSeverity(data.status)" /></template></Column><Column field="updatedAt" header="更新时间"><template #body="{ data }">{{ new Date(data.updatedAt).toLocaleString("zh-CN") }}</template></Column><Column field="viewCount" header="阅读" /></DataTable></main></div>
</template>
