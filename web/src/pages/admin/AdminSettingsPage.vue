<script setup lang="ts">
import { reactive } from 'vue'

import { useAdminSettingsPage } from '@/composables/useAdminSettingsPage'

const settings = reactive(useAdminSettingsPage())
</script>

<template>
  <section class="admin-section admin-config-page">
    <header class="admin-page-heading">
      <div>
        <h2>站点设置</h2>
        <p class="panel__text">管理站点名称、简介卡片、公告和 SMTP。站长信息与站长链接已移动到首页配置。</p>
      </div>
    </header>

    <section v-if="settings.loading" class="panel admin-dialog__empty">正在加载站点设置...</section>

    <section v-else class="panel admin-profile-editor admin-settings-editor">
      <div class="admin-profile-editor__section">
        <div>
          <p class="panel__label">Brand</p>
          <h3>站点基础</h3>
        </div>
        <div class="admin-profile-editor__grid">
          <label class="admin-form-field">
            <span>站点标题</span>
            <input v-model="settings.form.siteTitle" class="admin-input" type="text" />
            <small>会显示在首页导航、标题区以及部分浏览器标题位置。</small>
          </label>
          <label class="admin-form-field">
            <span>博客名称</span>
            <input v-model="settings.form.introBlogName" class="admin-input" type="text" />
            <small>用于左侧简介卡片中的博客名称。</small>
          </label>
          <label class="admin-form-field admin-profile-editor__field--full">
            <span>一言 / 简介语</span>
            <textarea v-model="settings.form.introHitokoto" class="admin-textarea" rows="4" />
            <small>显示在首页左侧简介卡片里。</small>
          </label>
          <label class="admin-form-field admin-profile-editor__field--full">
            <span>公告</span>
            <textarea v-model="settings.form.announcement" class="admin-textarea" rows="4" />
            <small>显示在首页公告卡片中，和首页配置页使用同一份数据。</small>
          </label>
        </div>
      </div>

      <div class="admin-profile-editor__section">
        <div>
          <p class="panel__label">SMTP</p>
          <h3>邮件服务配置</h3>
        </div>
        <div class="admin-profile-editor__grid">
          <label class="admin-form-field">
            <span>SMTP Host</span>
            <input v-model="settings.form.smtpHost" class="admin-input" type="text" placeholder="smtp.example.com" />
            <small>邮件服务器地址，例如 `smtp.qq.com` 或 `smtp.gmail.com`。</small>
          </label>
          <label class="admin-form-field">
            <span>端口</span>
            <input v-model="settings.form.smtpPort" class="admin-input" type="text" placeholder="587" />
            <small>常见端口为 `25`、`465`、`587`。</small>
          </label>
          <label class="admin-form-field">
            <span>用户名</span>
            <input v-model="settings.form.smtpUsername" class="admin-input" type="text" placeholder="mailer@example.com" />
            <small>通常是邮箱地址或 SMTP 用户名。</small>
          </label>
          <label class="admin-form-field">
            <span>密码 / 授权码</span>
            <input v-model="settings.form.smtpPassword" class="admin-input" type="password" placeholder="输入授权码或密码" />
            <small>建议使用 SMTP 授权码，不直接使用邮箱登录密码。</small>
          </label>
          <label class="admin-form-field">
            <span>发件人名称</span>
            <input v-model="settings.form.smtpFromName" class="admin-input" type="text" placeholder="Cashew Blog" />
            <small>邮件显示的发件人名称。</small>
          </label>
          <label class="admin-form-field">
            <span>发件人邮箱</span>
            <input v-model="settings.form.smtpFromEmail" class="admin-input" type="email" placeholder="noreply@example.com" />
            <small>邮件发件地址，建议与 SMTP 账号一致。</small>
          </label>
          <label class="admin-form-field">
            <span>加密方式</span>
            <select v-model="settings.form.smtpEncryption" class="admin-select">
              <option value="none">无</option>
              <option value="ssl">SSL</option>
              <option value="tls">TLS</option>
            </select>
            <small>常见组合是 `465 + SSL` 或 `587 + TLS`。</small>
          </label>
        </div>
      </div>

      <p v-if="settings.errorMessage" class="login-form__error">{{ settings.errorMessage }}</p>
      <p v-if="settings.successMessage" class="admin-profile-editor__success">{{ settings.successMessage }}</p>
      <div class="admin-confirm__actions admin-confirm__actions--start">
        <button class="button button--primary" type="button" :disabled="settings.saving" @click="settings.submit">
          {{ settings.saving ? '保存中...' : '保存站点设置' }}
        </button>
      </div>
    </section>
  </section>
</template>
