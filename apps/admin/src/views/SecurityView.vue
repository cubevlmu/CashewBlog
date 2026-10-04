<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import SettingsGroup from "../components/SettingsGroup.vue";
import { http } from "../api/http";
import type { SecuritySettingsDto } from "../api/types";
import TurnstileWidget from "../components/TurnstileWidget.vue";
import { rememberEntrance } from "../entrance";
import { attempt } from "../state";
const currentPassword = ref(""),
  newPassword = ref(""),
  busy = ref(false),
  saved = ref(false);
const settings = ref<SecuritySettingsDto | null>(null);
const loginPath = ref("");
const turnstileEnabled = ref(false);
const siteKey = ref("");
const secretKey = ref("");
const token = ref<string | null>(null);
const challenge = ref<InstanceType<typeof TurnstileWidget> | null>(null);
const loading = ref(true);
const turnstileChanged = computed(() => turnstileEnabled.value && (siteKey.value !== settings.value?.turnstileSiteKey || !!secretKey.value));
const securityReady = computed(() => !turnstileChanged.value || (!!siteKey.value.trim() && !!secretKey.value.trim() && !!token.value));
onMounted(async () => {
  await attempt(async () => {
    settings.value = await http.get<SecuritySettingsDto>("/api/admin/security");
    loginPath.value = settings.value.loginPath;
    turnstileEnabled.value = settings.value.hasTurnstileSecret;
    siteKey.value = settings.value.turnstileSiteKey ?? "";
  });
  loading.value = false;
});
watch(() => [turnstileEnabled.value, siteKey.value, secretKey.value], () => {
  token.value = null;
  challenge.value?.reset();
});
async function changePassword() {
  busy.value = true;
  saved.value = false;
  await attempt(async () => {
    await http.post("/api/admin/password", {
      currentPassword: currentPassword.value,
      newPassword: newPassword.value,
    });
    currentPassword.value = "";
    newPassword.value = "";
    saved.value = true;
  });
  busy.value = false;
}
async function saveSecurity() {
  if (!securityReady.value) return;
  busy.value = true;
  saved.value = false;
  await attempt(async () => {
    const next = await http.put<SecuritySettingsDto>("/api/admin/security", {
      currentPassword: currentPassword.value,
      loginPath: loginPath.value,
      turnstileEnabled: turnstileEnabled.value,
      turnstileSiteKey: siteKey.value || null,
      turnstileSecretKey: secretKey.value || null,
      turnstileToken: token.value,
    });
    settings.value = next;
    loginPath.value = next.loginPath;
    siteKey.value = next.turnstileSiteKey ?? "";
    secretKey.value = "";
    currentPassword.value = "";
    token.value = null;
    rememberEntrance(next.loginPath);
    saved.value = true;
  });
  busy.value = false;
}
</script>
<template>
  <div class="flex flex-col gap-5">
    <SettingsGroup title="登录防护" hint="修改登录入口可以减少公开扫描命中；请把新地址保存到密码管理器。" root>
      <Message v-if="saved" severity="success" class="mb-4">安全设置已更新</Message>
      <form class="flex flex-col gap-5" @submit.prevent="saveSecurity">
        <Fluid class="grid grid-cols-1 gap-x-8 gap-y-5 md:grid-cols-2">
          <div class="flex min-w-0 flex-col gap-1.5">
            <label for="login-path" class="text-sm font-medium">登录入口</label>
            <InputText id="login-path" v-model="loginPath" maxlength="65" placeholder="/cashew-door" required :disabled="loading" />
            <small class="text-[var(--p-text-muted-color)]">4–64 位字母、数字、下划线或短横线的单一路径段。</small>
          </div>
          <div class="flex min-w-0 flex-col gap-1.5">
            <label class="text-sm font-medium">Cloudflare Turnstile</label>
            <ToggleSwitch v-model="turnstileEnabled" :disabled="loading" />
            <small class="text-[var(--p-text-muted-color)]">启用后登录必须通过 Cloudflare 人机验证。</small>
          </div>
          <template v-if="turnstileEnabled">
            <div class="flex min-w-0 flex-col gap-1.5">
              <label for="turnstile-site" class="text-sm font-medium">Site Key</label>
              <InputText id="turnstile-site" v-model="siteKey" maxlength="200" required />
            </div>
            <div class="flex min-w-0 flex-col gap-1.5">
              <label for="turnstile-secret" class="text-sm font-medium">Secret Key</label>
              <Password v-model="secretKey" input-id="turnstile-secret" :feedback="false" toggle-mask :placeholder="settings?.hasTurnstileSecret ? '留空以保留当前密钥' : ''" :input-props="{ maxlength: 200, autocomplete: 'off' }" />
            </div>
            <div v-if="turnstileChanged" class="md:col-span-2">
              <TurnstileWidget ref="challenge" :site-key="siteKey.trim()" @token="token = $event" />
            </div>
          </template>
        </Fluid>
        <div class="flex min-w-0 flex-col gap-1.5 md:max-w-sm">
          <label for="security-current-password" class="text-sm font-medium">当前密码</label>
          <Password v-model="currentPassword" input-id="security-current-password" :feedback="false" toggle-mask required :input-props="{ autocomplete: 'current-password' }" />
        </div>
        <Button label="保存安全设置" icon="pi pi-shield" type="submit" class="self-start" :loading="busy" :disabled="loading || !securityReady" />
      </form>
    </SettingsGroup>
    <SettingsGroup title="修改密码" hint="修改后当前会话保持登录，其他设备需要重新登录。" root>
      <Message v-if="saved" severity="success" class="mb-4">密码已更新</Message>
      <form class="flex flex-col gap-5" @submit.prevent="changePassword">
        <Fluid class="grid grid-cols-1 gap-x-8 gap-y-5 md:grid-cols-2">
          <div class="flex min-w-0 flex-col gap-1.5">
            <label for="current-password" class="text-sm font-medium">当前密码</label>
            <Password
              v-model="currentPassword"
              input-id="current-password"
              :feedback="false"
              toggle-mask
              required
              :input-props="{ autocomplete: 'current-password' }"
            />
          </div>
          <div class="flex min-w-0 flex-col gap-1.5">
            <label for="new-password" class="text-sm font-medium">新密码</label>
            <Password
              v-model="newPassword"
              input-id="new-password"
              toggle-mask
              required
              :input-props="{ minlength: 8, autocomplete: 'new-password' }"
            />
            <small class="text-[var(--p-text-muted-color)]">至少 8 位。</small>
          </div>
        </Fluid>
        <Button label="修改密码" icon="pi pi-lock" type="submit" class="self-start" :loading="busy" />
      </form>
    </SettingsGroup>
    <SettingsGroup
      title="导出"
      hint="导出设置 JSON 或文章 Markdown ZIP；媒体文件不包含在导出中，完整数据库备份请使用 pg_dump。"
      root
    >
      <div class="flex flex-wrap gap-2">
        <Button as="a" href="/api/admin/export/settings" label="导出设置 JSON" icon="pi pi-download" severity="secondary" outlined />
        <Button as="a" href="/api/admin/export/posts" label="导出文章 ZIP" icon="pi pi-download" severity="secondary" outlined />
      </div>
    </SettingsGroup>
  </div>
</template>
