<script setup lang="ts">
import { reactive } from 'vue'

import { useLoginPage } from '@/composables/useLoginPage'

const login = reactive(useLoginPage())
</script>

<template>
  <section class="login-page">
    <div class="login-card panel">
      <div class="login-card__intro">
        <p class="panel__label">Auth</p>
        <h1>登录</h1>
      </div>

      <div v-if="login.authState.isLoggedIn" class="login-card__status">
        <p class="panel__text">当前已登录为 {{ login.authState.user?.displayName }}（{{ login.authState.user?.role }}）。</p>
        <RouterLink class="button button--primary" :to="login.authState.isAdmin ? '/admin/dashboard' : '/'">
          {{ login.authState.isAdmin ? '进入后台' : '返回首页' }}
        </RouterLink>
      </div>

      <form v-else class="login-form" @submit.prevent="login.submitLogin">
        <label class="login-form__field">
          <span>用户名</span>
          <input v-model="login.form.username" class="input" type="text" placeholder="输入用户名" />
        </label>

        <label class="login-form__field">
          <span>密码</span>
          <input v-model="login.form.password" class="input" type="password" placeholder="输入密码" />
        </label>

        <p v-if="login.errorMessage" class="login-form__error">{{ login.errorMessage }}</p>

        <button class="button button--primary" type="submit" :disabled="login.loading">
          {{ login.loading ? '登录中...' : '登录' }}
        </button>
      </form>
    </div>
  </section>
</template>
