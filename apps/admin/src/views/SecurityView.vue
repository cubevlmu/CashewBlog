<script setup lang="ts">
import { ref } from "vue";
import { http } from "../api/http";
import { attempt } from "../state";
const currentPassword = ref(""),
  newPassword = ref(""),
  busy = ref(false),
  saved = ref(false);
async function changePassword() {
  busy.value = true;
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
</script>
<template>
  <Panel header="修改密码"
    ><Message v-if="saved" severity="success">密码已更新</Message
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
        ><Button label="修改密码" type="submit" :loading="busy" /></form
    ></Fluid>
  </Panel>
  <Panel header="导出"
    ><p class="mb-4 text-sm text-[var(--p-text-muted-color)]">
      导出设置 JSON 或文章 Markdown ZIP；媒体文件不包含在导出中，完整数据库备份请使用 pg_dump。
    </p>
    <div class="flex flex-wrap gap-2">
      <Button
        as="a"
        href="/api/admin/export/settings"
        label="导出设置 JSON" /><Button
        as="a"
        href="/api/admin/export/posts"
        label="导出文章 ZIP"
      />
    </div>
  </Panel>
</template>
