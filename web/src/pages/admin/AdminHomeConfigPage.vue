<script setup lang="ts">
import { reactive } from 'vue'

import AdminConfigLinksEditor from '@/components/AdminConfigLinksEditor.vue'
import { useAdminHomeConfigPage } from '@/composables/useAdminHomeConfigPage'

const homeConfig = reactive(useAdminHomeConfigPage())
</script>

<template>
  <section class="admin-section admin-config-page">
    <header class="admin-page-heading">
      <div>
        <h2>首页配置</h2>
        <p class="panel__text">管理首页导航、头图、公告、侧边栏 HTML、站长信息和页脚文案。保存后，首页会直接读取这里的最新配置。</p>
      </div>
    </header>

    <section v-if="homeConfig.loading" class="panel admin-dialog__empty">正在加载首页配置...</section>

    <section v-else class="panel admin-profile-editor admin-home-config-editor">
      <div class="admin-profile-editor__section admin-home-config-editor__section">
        <div class="admin-profile-editor__grid">
          <label class="admin-form-field admin-profile-editor__field--full">
            <span>导航标题</span>
            <input v-model="homeConfig.form.navbarHeadText" class="admin-input" type="text" />
            <small>显示在首页左上角品牌位置。</small>
          </label>
        </div>
      </div>

      <AdminConfigLinksEditor
        v-model="homeConfig.form.navbarLinks"
        label="Navbar"
        title="导航配置"
        add-text="新增导航项"
        name-placeholder="导航名称"
        link-placeholder="链接地址，如 /about"
        :show-icon="false"
      />

      <div class="admin-profile-editor__section admin-home-config-editor__section">
        <div>
          <p class="panel__label">Hero</p>
          <h3>头图配置</h3>
        </div>
        <div class="admin-profile-editor__grid admin-home-config-editor__hero-grid">
          <label class="admin-form-field">
            <span>主标题</span>
            <input v-model="homeConfig.form.heroTitle" class="admin-input" type="text" />
            <small>首页头图最主要的标题文案。</small>
          </label>
          <label class="admin-form-field">
            <span>背景图</span>
            <input v-model="homeConfig.form.heroImage" class="admin-input" type="text" />
            <small>当前支持 Bing 图源或自定义图片地址。</small>
          </label>
          <label class="admin-form-field admin-profile-editor__field--full">
            <span>副标题</span>
            <textarea v-model="homeConfig.form.heroSubtitle" class="admin-textarea" rows="4" />
          </label>
          <label class="admin-form-field">
            <span>打字动画</span>
            <select v-model="homeConfig.form.heroAnimation" class="admin-select">
              <option :value="true">开启</option>
              <option :value="false">关闭</option>
            </select>
            <small>开启后首页头图主标题会按打字机方式显示。</small>
          </label>
        </div>
      </div>

      <div class="admin-profile-editor__section admin-home-config-editor__section">
        <div>
          <p class="panel__label">Announcement</p>
          <h3>公告</h3>
        </div>
        <label class="admin-form-field">
          <span>公告内容</span>
          <textarea v-model="homeConfig.form.announcement" class="admin-textarea" rows="5" />
          <small>为空时首页公告卡片可隐藏。</small>
        </label>
      </div>

      <div class="admin-profile-editor__section admin-home-config-editor__section">
        <div>
          <p class="panel__label">Sidebar</p>
          <h3>侧边栏自定义 HTML</h3>
        </div>
        <label class="admin-form-field">
          <span>预留区域 HTML</span>
          <textarea v-model="homeConfig.form.sidebarCustomHtml" class="admin-textarea" rows="6" />
          <small>显示在首页侧边栏“预留区域”位置，支持自定义 HTML。</small>
        </label>
      </div>

      <div class="admin-profile-editor__section admin-home-config-editor__section">
        <div>
          <p class="panel__label">Owner</p>
          <h3>站长信息</h3>
        </div>
        <div class="admin-profile-editor__grid">
          <label class="admin-form-field">
            <span>站长名称</span>
            <input v-model="homeConfig.form.ownerName" class="admin-input" type="text" />
            <small>为空时首页只隐藏头像、名称和简介，不影响链接显示。</small>
          </label>
          <label class="admin-form-field">
            <span>站长头像</span>
            <input v-model="homeConfig.form.ownerAvatar" class="admin-input" type="text" />
            <small>为空时首页不显示头像。</small>
          </label>
          <label class="admin-form-field admin-profile-editor__field--full">
            <span>站长简介</span>
            <textarea v-model="homeConfig.form.ownerBio" class="admin-textarea" rows="4" />
            <small>为空时首页不显示简介。</small>
          </label>
        </div>
      </div>

      <AdminConfigLinksEditor
        v-model="homeConfig.form.ownerLinks"
        label="Owner Links"
        title="站长链接"
        add-text="新增链接"
        name-placeholder="名称"
        icon-placeholder="自定义图标文案，如 GH / 邮 / *"
        link-placeholder="链接地址"
        :show-icon="true"
        hint="没有站长名字时，链接仍会单独显示；没有链接时则不显示链接区。"
      />

      <div class="admin-profile-editor__section admin-home-config-editor__section">
        <div>
          <p class="panel__label">Footer</p>
          <h3>页脚配置</h3>
        </div>
        <div class="admin-profile-editor__grid">
          <label class="admin-form-field admin-profile-editor__field--full">
            <span>页脚主文案</span>
            <input v-model="homeConfig.form.footerText" class="admin-input" type="text" />
            <small>显示为页脚第一行纯文本。</small>
          </label>
          <label class="admin-form-field admin-profile-editor__field--full">
            <span>页脚附加 HTML</span>
            <textarea v-model="homeConfig.form.footerExtraHtml" class="admin-textarea" rows="5" />
            <small>显示为页脚第二行，支持自定义 HTML。</small>
          </label>
        </div>
      </div>

      <p v-if="homeConfig.errorMessage" class="login-form__error">{{ homeConfig.errorMessage }}</p>
      <p v-if="homeConfig.successMessage" class="admin-profile-editor__success">{{ homeConfig.successMessage }}</p>
      <div class="admin-confirm__actions admin-confirm__actions--start">
        <button class="button button--primary" type="button" :disabled="homeConfig.saving" @click="homeConfig.submit">
          {{ homeConfig.saving ? '保存中...' : '保存首页配置' }}
        </button>
      </div>
    </section>
  </section>
</template>
