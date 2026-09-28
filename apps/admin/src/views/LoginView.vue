<script setup lang="ts">
import { ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { http } from "../api/http";
import type { SessionDto } from "../api/types";
import { attempt, session } from "../state";
const password = ref(""),
  busy = ref(false);
const route = useRoute(),
  router = useRouter();
async function login() {
  busy.value = true;
  await attempt(async () => {
    session.value = await http.post<SessionDto>(
      "/api/admin/login",
      { password: password.value },
      { skipAuthRedirect: true },
    );
    password.value = "";
    const next =
      typeof route.query.next === "string" &&
      /^\/admin(?:\/|$)/.test(route.query.next) &&
      !route.query.next.startsWith("/admin/login")
        ? route.query.next
        : "/admin";
    await router.replace(next);
  });
  busy.value = false;
}
</script>
<template>
  <Card
    ><template #title>登录 CashewBlog</template
    ><template #content
      ><Fluid
        ><form @submit.prevent="login">
          <Field label="管理员密码"
            ><Password
              v-model="password"
              input-id="password"
              :feedback="false"
              toggle-mask
              autocomplete="current-password"
              required /></Field
          ><Button
            type="submit"
            label="登录"
            :loading="busy"
          /></form></Fluid></template
  ></Card>
</template>
