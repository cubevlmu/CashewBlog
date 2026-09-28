<script setup lang="ts">
import { reactive, ref, watch } from "vue";
import { useRouter } from "vue-router";
import { http } from "../api/http";
import { attempt, setup } from "../state";
import type { InitializeRequest, DatabaseTestResult } from "../api/types";
const router = useRouter();
const defaults = setup.value!.defaults;
const form = reactive<InitializeRequest>({
  siteName: "我的博客",
  siteUrl: location.origin,
  adminName: "博主",
  timezone: defaults.timezone,
  password: "",
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
  busy.value = true;
  await attempt(async () => {
    await http.post("/api/setup/initialize", form);
    form.password = "";
    confirmation.value = "";
    form.database.password = "";
    setup.value = null;
    await router.replace("/admin/login");
  });
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
                    required
                    maxlength="100" /></Field
                ><Field label="站点网址"
                  ><InputText
                    v-model="form.siteUrl"
                    type="url"
                    required /></Field
                ><Field label="管理员昵称"
                  ><InputText v-model="form.adminName" required /></Field
                ><Field label="时区"
                  ><InputText v-model="form.timezone" required /></Field
              ></StepPanel>
              <StepPanel :value="1"
                ><Field label="密码（至少 8 位）"
                  ><Password
                    v-model="form.password"
                    toggle-mask
                    required
                    :input-props="{
                      minlength: 8,
                      autocomplete: 'new-password',
                    }" /></Field
                ><Field label="确认密码"
                  ><Password
                    v-model="confirmation"
                    :feedback="false"
                    toggle-mask
                    required /></Field
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
                  ><InputText v-model="form.database[key]" required /></Field
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
                  ><InputText v-model="form.storage!.root" required /></Field
                ><Field label="最大上传大小（字节）"
                  ><InputNumber
                    v-model="form.storage!.maxUploadBytes"
                    :min="1" /></Field
              ></StepPanel>
              <StepPanel :value="4"
                ><Message severity="info"
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
                :disabled="step === 2 && !test?.ok" /></template
          ></Toolbar></form
      ></Fluid> </template
  ></Card>
</template>
