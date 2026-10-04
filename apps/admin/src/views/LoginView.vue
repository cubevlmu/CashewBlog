<script setup lang="ts">
// Split-screen sign-in: a hero (site banner, else a public wallpaper) with a hitokoto quote on the
// left, the password form on the right. Only same-origin API calls carry credentials; the quote
// and fallback image are credential-less, referrer-less cross-origin requests.
import { computed, onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import InputGroup from "primevue/inputgroup";
import InputGroupAddon from "primevue/inputgroupaddon";
import { ApiError, http } from "../api/http";
import type { BootstrapDto, LoginOptionsDto, SessionDto } from "../api/types";
import TurnstileWidget from "../components/TurnstileWidget.vue";
import { rememberEntrance, safeNext } from "../entrance";
import { useAuthQuote } from "../auth-quote";
import { errorMessage, failure, session } from "../state";
import { dark, toggleTheme } from "../theme";

const FALLBACK_HERO = "https://t.alcy.cc/fj";
const logoSrc = `${import.meta.env.BASE_URL}cashew_logo.png`;
const password = ref(""),
  busy = ref(false),
  siteName = ref("CashewBlog"),
  banner = ref<string | null>(null),
  heroFailed = ref(false);
const route = useRoute(),
  router = useRouter();
const { quote, source } = useAuthQuote();
const hero = computed(() => banner.value ?? FALLBACK_HERO);
const year = new Date().getFullYear();
const options = ref<LoginOptionsDto | null>(null);
const token = ref<string | null>(null);
const challenge = ref<InstanceType<typeof TurnstileWidget> | null>(null);
const retryAt = ref(0);
const canLogin = computed(() => options.value !== null && (!options.value.turnstileSiteKey || !!token.value));

onMounted(async () => {
  failure.value = "";
  try {
    options.value = await http.get<LoginOptionsDto>("/api/admin/login/options");
  } catch {
    failure.value = "登录入口已失效，请从当前登录地址重新打开页面。";
  }
  try {
    const { settings } = await http.get<BootstrapDto>("/api/site/bootstrap");
    siteName.value = settings.general.siteName || siteName.value;
    const images = settings.banner.desktop;
    if (images.length) banner.value = images[Math.floor(Math.random() * images.length)]!;
  } catch {
    // Branding is decorative; the form works without it.
  }
});
function onHeroError() {
  // A broken site banner falls back to the wallpaper once; a broken wallpaper leaves the gradient.
  if (banner.value) banner.value = null;
  else heroFailed.value = true;
}

async function login() {
  if (busy.value || !canLogin.value) return;
  if (Date.now() < retryAt.value) {
    failure.value = `请在 ${Math.ceil((retryAt.value - Date.now()) / 60000)} 分钟后重试。`;
    return;
  }
  busy.value = true;
  failure.value = "";
  try {
    session.value = await http.post<SessionDto>("/api/admin/login", { password: password.value, turnstileToken: token.value }, { skipAuthRedirect: true });
    password.value = "";
    rememberEntrance(route.path.replace(/\/$/, ""));
    await router.replace(safeNext(route.query.next));
  } catch (error) {
    if (error instanceof ApiError && error.code === "login_locked") {
      const seconds = typeof error.body.retryAfterSeconds === "number" ? error.body.retryAfterSeconds : 60;
      retryAt.value = Date.now() + seconds * 1000;
      failure.value = `密码错误次数过多，请在 ${Math.ceil(seconds / 60)} 分钟后重试。`;
    } else {
      const messages: Record<string, string> = {
        invalid_password: "密码不正确。",
        turnstile_failed: "人机验证失败，请重新完成验证。",
        rate_limited: "请求过于频繁，请稍后重试。",
        not_found: "登录入口已失效，请从当前登录地址重新打开页面。",
      };
      failure.value = error instanceof ApiError ? messages[error.code] ?? errorMessage(error) : errorMessage(error);
    }
  } finally {
    token.value = null;
    challenge.value?.reset();
    busy.value = false;
  }
}
</script>
<template>
  <main class="min-h-dvh bg-slate-50 font-sans text-[var(--p-text-color)] lg:grid lg:h-dvh lg:grid-cols-[minmax(0,1fr)_minmax(420px,520px)] dark:bg-zinc-950">
    <section class="relative hidden overflow-hidden bg-gradient-to-br from-orange-400 via-rose-500 to-zinc-900 text-white lg:block">
      <img
        v-if="!heroFailed"
        :key="hero"
        :src="hero"
        alt=""
        class="absolute inset-0 size-full object-cover"
        fetchpriority="high"
        referrerpolicy="no-referrer"
        @error="onHeroError"
      />
      <div class="absolute inset-0 bg-gradient-to-t from-black/70 via-black/25 to-black/30" />
      <div class="relative flex h-full flex-col px-12 py-10">
        <div class="flex items-center gap-3">
          <img :src="logoSrc" alt="" class="size-9 rounded-lg" />
          <div class="leading-tight">
            <div class="font-semibold">{{ siteName }}</div>
            <div class="text-xs text-white/70">管理后台</div>
          </div>
        </div>
        <figure class="m-0 mt-auto max-w-xl pb-6">
          <figcaption class="text-sm font-medium text-white/70">一言 · {{ source }}</figcaption>
          <blockquote class="m-0 mt-3 text-3xl leading-tight font-semibold xl:text-4xl">{{ quote }}</blockquote>
        </figure>
      </div>
    </section>

    <section class="flex min-h-dvh min-w-0 flex-col px-5 py-6 sm:px-10 lg:h-dvh lg:min-h-0 lg:overflow-y-auto lg:px-14">
      <div class="flex items-center justify-between gap-3">
        <div class="flex items-center gap-2.5 lg:invisible">
          <img :src="logoSrc" alt="" class="size-8 rounded-lg" />
          <span class="font-semibold">{{ siteName }}</span>
        </div>
        <Button
          :icon="dark ? 'pi pi-sun' : 'pi pi-moon'"
          text
          severity="secondary"
          rounded
          aria-label="切换后台明暗模式"
          title="切换明暗模式"
          @click="toggleTheme"
        />
      </div>

      <div class="mx-auto my-auto w-full max-w-sm py-10">
        <span class="mb-4 flex size-10 items-center justify-center rounded-md bg-[var(--p-primary-color)] text-[var(--p-primary-contrast-color)]">
          <i class="pi pi-lock" aria-hidden="true" />
        </span>
        <h1 class="m-0 text-2xl font-semibold">登录</h1>
        <p class="mt-2 mb-7 text-sm leading-6 text-[var(--p-text-muted-color)]">输入管理员密码以继续管理 {{ siteName }}。</p>

        <form class="flex flex-col gap-5" @submit.prevent="login">
          <div class="flex flex-col gap-2">
            <label for="password" class="text-sm font-medium">管理员密码</label>
            <InputGroup>
              <InputGroupAddon><i class="pi pi-key" aria-hidden="true" /></InputGroupAddon>
              <Password
                v-model="password"
                input-id="password"
                :feedback="false"
                toggle-mask
                autocomplete="current-password"
                placeholder="输入密码"
                required
                autofocus
                fluid
                input-class="w-full"
              />
            </InputGroup>
          </div>
          <TurnstileWidget v-if="options?.turnstileSiteKey" ref="challenge" :site-key="options.turnstileSiteKey" @token="token = $event" />
          <Message v-if="failure" severity="error" size="small">{{ failure }}</Message>
          <Button type="submit" label="登录" icon="pi pi-arrow-right" icon-pos="right" :loading="busy" :disabled="!canLogin" class="w-full" />
        </form>
      </div>

      <p class="m-0 pb-1 text-center text-xs tracking-wide text-[var(--p-text-muted-color)]">© {{ year }} {{ siteName }} · Powered by CashewBlog</p>
    </section>
  </main>
</template>
