<script setup lang="ts">
import { computed, reactive, ref, watch } from "vue";
import { http } from "../api/http";
import { attempt, setup } from "../state";
import type { InitializeRequest, InitializeResult, DatabaseTestResult } from "../api/types";
import TurnstileWidget from "../components/TurnstileWidget.vue";
import { rememberEntrance } from "../entrance";
const defaults = setup.value!.defaults;
const form = reactive<InitializeRequest>({
  siteName: "我的博客",
  siteUrl: location.origin,
  adminName: "博主",
  timezone: defaults.timezone,
  password: "",
  security: { loginPath: "", turnstileSiteKey: "", turnstileSecretKey: "", turnstileToken: null },
  database: {
    host: "127.0.0.1",
    port: defaults.databasePort,
    database: "cashewblog",
    username: "postgres",
    password: "",
    sslMode: defaults.sslMode as "Prefer",
  },
  storage: {
    root: defaults.storageRoot,
    maxUploadBytes: defaults.maxUploadBytes,
  },
});
const step = ref(0),
  confirmation = ref(""),
  busy = ref(false),
  test = ref<DatabaseTestResult | null>(null);
const stepLabels = ["站点", "管理员", "数据库", "存储", "初始化"];
const turnstileEnabled = ref(false);
const challenge = ref<InstanceType<typeof TurnstileWidget> | null>(null);
const needsChallenge = computed(() => turnstileEnabled.value && !!form.security!.turnstileSiteKey?.trim());
const securityReady = computed(() => !turnstileEnabled.value || !!(form.security!.turnstileSiteKey?.trim() && form.security!.turnstileSecretKey?.trim() && form.security!.turnstileToken));
watch(() => [turnstileEnabled.value, form.security!.turnstileSiteKey, form.security!.turnstileSecretKey], () => {
  form.security!.turnstileToken = null;
  challenge.value?.reset();
});
watch(
  () => form.database,
  () => {
    test.value = null;
  },
  { deep: true },
);
async function testDatabase() {
  busy.value = true;
  await attempt(async () => {
    test.value = await http.post<DatabaseTestResult>(
      "/api/setup/database/test",
      form.database,
    );
  });
  busy.value = false;
}
function next() {
  if (
    step.value === 1 &&
    (form.password.length < 8 || form.password !== confirmation.value)
  )
    return;
  if (step.value === 2 && !test.value?.ok) return;
  step.value++;
}
async function initialize() {
  if (busy.value || !securityReady.value) return;
  busy.value = true;
  await attempt(async () => {
    const result = await http.post<InitializeResult>("/api/setup/initialize", {
      ...form,
      security: { ...form.security, ...(!turnstileEnabled.value ? { turnstileSiteKey: null, turnstileSecretKey: null, turnstileToken: null } : {}) },
    });
    form.password = "";
    confirmation.value = "";
    form.database.password = "";
    form.security!.turnstileSecretKey = "";
    rememberEntrance(result.redirectTo);
    setup.value = null;
    window.location.assign(result.redirectTo);
  });
  form.security!.turnstileToken = null;
  challenge.value?.reset();
  busy.value = false;
}
</script>
<template>
  <Card
    ><template #title>初始化 CashewBlog</template
    ><template #content>
      <Fluid
        ><form @submit.prevent="step === 4 ? initialize() : next()">
          <Stepper v-model:value="step" linear>
            <StepList
              ><Step
                v-for="(label, index) in stepLabels"
                :key="label"
                :value="index"
                >{{ label }}</Step
              ></StepList
            >
            <StepPanels>
              <StepPanel :value="0"
                ><Field label="站点名称"
                  ><InputText
                    v-model="form.siteName"
                    :required="step === 0"
                    maxlength="100" /></Field
                ><Field label="站点网址"
                  ><InputText
                    v-model="form.siteUrl"
                    type="url"
                    :required="step === 0" /></Field
                ><Field label="管理员昵称"
                  ><InputText v-model="form.adminName" :required="step === 0" /></Field
                ><Field label="时区"
                  ><InputText v-model="form.timezone" :required="step === 0" /></Field
              ></StepPanel>
              <StepPanel :value="1"
                ><Field label="密码（至少 8 位）"
                  ><Password
                    v-model="form.password"
                    toggle-mask
                    :required="step === 1"
                    :input-props="{
                      minlength: 8,
                      autocomplete: 'new-password',
                    }" /></Field
                ><Field label="确认密码"
                  ><Password
                    v-model="confirmation"
                    :feedback="false"
                    toggle-mask
                    :required="step === 1" /></Field
                ><Message
                  v-if="confirmation && confirmation !== form.password"
                  severity="error"
                  >两次密码不一致</Message
                ></StepPanel
              >
              <StepPanel :value="2"
                ><Message severity="info"
                  >请先创建数据库，初始化会自动创建表结构。</Message
                ><Field
                  v-for="key in ['host', 'database', 'username'] as const"
                  :key="key"
                  :label="
                    {
                      host: '主机',
                      database: '数据库名',
                      username: '用户名',
                    }[key]
                  "
                  ><InputText v-model="form.database[key]" :required="step === 2" /></Field
                ><Field label="端口"
                  ><InputNumber
                    v-model="form.database.port"
                    :min="1"
                    :max="65535"
                    :use-grouping="false" /></Field
                ><Field label="数据库密码"
                  ><Password
                    v-model="form.database.password"
                    :feedback="false"
                    toggle-mask /></Field
                ><Field label="SSL 模式"
                  ><Select
                    v-model="form.database.sslMode"
                    :options="[
                      'Disable',
                      'Allow',
                      'Prefer',
                      'Require',
                      'VerifyCA',
                      'VerifyFull',
                    ]" /></Field
                ><Button
                  label="测试连接"
                  :loading="busy"
                  @click="testDatabase"
                /><Message v-if="test" :severity="test.ok ? 'success' : 'error'">{{
                  test.message
                }}</Message></StepPanel
              >
              <StepPanel :value="3"
                ><Field label="上传目录"
                  ><InputText v-model="form.storage!.root" :required="step === 3" /></Field
                ><Field label="最大上传大小（字节）"
                  ><InputNumber
                    v-model="form.storage!.maxUploadBytes"
                    :min="1" /></Field
              ></StepPanel>
              <StepPanel :value="4"
                ><Field label="登录入口"
                  ><InputText v-model="form.security!.loginPath" placeholder="留空自动生成，如 /cashew-door" maxlength="65" />
                  <small>使用 /xxxx 格式：4–64 位字母、数字、下划线或短横线。初始化后请保存登录地址。</small>
                </Field>
                <Field label="启用 Cloudflare Turnstile 人机验证">
                  <ToggleSwitch v-model="turnstileEnabled" />
                </Field>
                <template v-if="turnstileEnabled">
                  <Field label="Turnstile Site Key"><InputText v-model="form.security!.turnstileSiteKey" maxlength="200" :required="step === 4" /></Field>
                  <Field label="Turnstile Secret Key"><Password v-model="form.security!.turnstileSecretKey" :feedback="false" toggle-mask :required="step === 4" :input-props="{ maxlength: 200, autocomplete: 'off' }" /></Field>
                  <Message severity="info">请在 Cloudflare 为本站域名创建 Turnstile 小组件，并完成验证以确认密钥可用。</Message>
                  <TurnstileWidget v-if="needsChallenge" ref="challenge" :site-key="form.security!.turnstileSiteKey!.trim()" @token="form.security!.turnstileToken = $event" />
                </template>
                <Message severity="info"
                  >即将为 {{ form.siteName }} 初始化数据库并保存配置。</Message
                ></StepPanel
              >
            </StepPanels>
          </Stepper>
          <Toolbar
            ><template #start
              ><Button
                v-if="step > 0"
                label="上一步"
                severity="secondary"
                :disabled="busy"
                @click="step--" /></template
            ><template #end
              ><Button
                type="submit"
                :label="step === 4 ? '开始初始化' : '下一步'"
                :loading="busy"
                :disabled="(step === 2 && !test?.ok) || (step === 4 && !securityReady)" /></template
          ></Toolbar></form
      ></Fluid> </template
  ></Card>
</template>
