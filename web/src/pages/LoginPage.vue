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
        <p class="panel__text">登录页已经走独立认证数据源，后续接 JWT 或 session 接口时只需要替换认证实现。</p>
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
          <input v-model="login.form.username" class="input" type="text" placeholder="输入 admin 或 user" />
        </label>

        <label class="login-form__field">
          <span>密码</span>
          <input v-model="login.form.password" class="input" type="password" placeholder="输入测试密码" />
        </label>

        <p v-if="login.errorMessage" class="login-form__error">{{ login.errorMessage }}</p>

        <button class="button button--primary" type="submit" :disabled="login.loading">
          {{ login.loading ? '登录中...' : '登录' }}
        </button>
      </form>

      <div class="login-demo">
        <p class="panel__label">测试账号</p>
        <div class="login-demo__grid">
          <button
            v-for="account in login.demoAccounts"
            :key="account.username"
            class="panel login-demo__card"
            type="button"
            @click="login.fillDemoAccount(account.username, account.password)"
          >
            <strong>{{ account.username }}</strong>
            <span>{{ account.password }}</span>
            <small>{{ account.role === 'admin' ? '可进后台' : '普通用户' }}</small>
          </button>
        </div>
      </div>
    </div>
  </section>
</template>
