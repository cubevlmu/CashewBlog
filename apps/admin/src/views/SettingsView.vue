<script setup lang="ts">
import { onMounted, ref, shallowRef } from "vue";
import { useConfirm } from "primevue/useconfirm";
import SettingsFields from "../components/SettingsFields.vue";
import { labels, type Value } from "../components/settings-fields";
import type { SiteSettings } from "../api/types";
import { http } from "../api/http";
import { attempt } from "../state";
const confirm = useConfirm(),
  settings = ref<SiteSettings>(),
  section = ref<Exclude<keyof SiteSettings, "schemaVersion">>("general"),
  busy = ref(false),
  saved = ref(false);
const draft = shallowRef<Value>({});
const sections = [
  "general",
  "profile",
  "appearance",
  "banner",
  "navigation",
  "sidebar",
  "announcement",
  "footer",
  "seo",
  "analytics",
  "article",
].map((value) => ({ label: labels[value], value }));
const currentPassword = ref(""),
  newPassword = ref("");
async function load() {
  await attempt(async () => {
    settings.value = await http.get<SiteSettings>("/api/admin/settings");
    changeSection();
  });
}
function changeSection() {
  if (settings.value)
    draft.value = JSON.parse(
      JSON.stringify(settings.value[section.value]),
    ) as unknown as Value;
  saved.value = false;
}
async function save() {
  busy.value = true;
  await attempt(async () => {
    settings.value = await http.put<SiteSettings>("/api/admin/settings", {
      [section.value]: draft.value,
    });
    saved.value = true;
  });
  busy.value = false;
}
function reset() {
  confirm.require({
    header: "恢复默认",
    message: "仅重置当前设置区，确定继续？",
    acceptLabel: "重置",
    rejectLabel: "取消",
    accept: () =>
      attempt(async () => {
        settings.value = await http.post<SiteSettings>(
          `/api/admin/settings/reset/${section.value}`,
        );
        changeSection();
      }),
  });
}
async function changePassword() {
  await attempt(async () => {
    await http.post("/api/admin/password", {
      currentPassword: currentPassword.value,
      newPassword: newPassword.value,
    });
    currentPassword.value = "";
    newPassword.value = "";
    saved.value = true;
  });
}
onMounted(load);
</script>
<template>
  <Panel header="站点设置"
    ><Toolbar
      ><template #start
        ><Select
          v-model="section"
          :options="sections"
          option-label="label"
          option-value="value"
          @change="changeSection" /></template
      ><template #end
        ><Button label="保存设置" :loading="busy" @click="save" /><Button
          label="恢复默认"
          severity="secondary"
          @click="reset" /></template
    ></Toolbar>
    <Message v-if="saved" severity="success">已保存</Message
    ><Message v-if="section === 'footer'" severity="warn"
      >页脚 HTML 中的脚本会在公开页面执行。请仅使用你信任的代码。</Message
    >
    <Fluid v-if="settings"
      ><SettingsFields v-model="draft" :path="section"
    /></Fluid> </Panel
  ><Fieldset legend="安全与导出" toggleable collapsed
    ><Fluid
      ><form @submit.prevent="changePassword">
        <Field label="当前密码"
          ><Password
            v-model="currentPassword"
            :feedback="false"
            required
            autocomplete="current-password" /></Field
        ><Field label="新密码（至少 8 位）"
          ><Password
            v-model="newPassword"
            required
            :input-props="{
              minlength: 8,
              autocomplete: 'new-password',
            }" /></Field
        ><Button label="修改密码" type="submit" /></form></Fluid
    ><Button
      as="a"
      href="/api/admin/export/settings"
      label="导出设置 JSON" /><Button
      as="a"
      href="/api/admin/export/posts"
      label="导出文章 ZIP"
  /></Fieldset>
</template>
