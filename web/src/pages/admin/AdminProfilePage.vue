<script setup lang="ts">
import { reactive } from 'vue'

import AdminUserProfileEditor from '@/components/AdminUserProfileEditor.vue'
import UserAvatar from '@/components/UserAvatar.vue'
import { useAdminProfilePage } from '@/composables/useAdminProfilePage'

const profile = reactive(useAdminProfilePage())
</script>

<template>
  <section class="admin-section admin-profile-page">
    <header class="admin-page-heading">
      <div>
        <h2>个人中心</h2>
        <p class="panel__text">参考 WordPress 个人资料页，集中维护账号资料、联系方式、个人简介和登录密码。</p>
      </div>
    </header>

    <section v-if="profile.currentUser" class="panel admin-profile-card">
      <div class="admin-profile-card__hero">
        <UserAvatar :src="profile.currentUser.avatar" :alt="profile.currentUser.displayName" size="xl" shape="rounded" />
        <div class="admin-profile-card__copy">
          <p class="panel__label">Account</p>
          <h3>{{ profile.currentUser.displayName }}</h3>
          <p class="panel__text">@{{ profile.currentUser.username }} · {{ profile.roleLabel }}</p>
        </div>
      </div>
    </section>

    <section class="panel">
      <AdminUserProfileEditor
        v-if="profile.currentUser"
        :username="profile.currentUser.username"
        :form="profile.profileForm"
        :can-edit-role="profile.canEditRole"
        :saving="profile.savingProfile"
        :error-message="profile.profileError"
        :success-message="profile.profileSuccess"
        submit-text="保存个人资料"
        @submit="profile.submitProfile"
      />
    </section>

    <section class="panel admin-profile-editor">
      <div class="admin-profile-editor__section">
        <div>
          <p class="panel__label">Password</p>
          <h3>账户管理</h3>
        </div>
        <div class="admin-profile-editor__grid">
          <label class="admin-form-field">
            <span>当前密码</span>
            <input v-model="profile.passwordForm.currentPassword" class="admin-input" type="password" />
          </label>
          <label class="admin-form-field">
            <span>新密码</span>
            <input v-model="profile.passwordForm.nextPassword" class="admin-input" type="password" />
          </label>
          <label class="admin-form-field">
            <span>确认新密码</span>
            <input v-model="profile.passwordForm.confirmPassword" class="admin-input" type="password" />
          </label>
        </div>
        <p v-if="profile.passwordError" class="login-form__error">{{ profile.passwordError }}</p>
        <p v-if="profile.passwordSuccess" class="admin-profile-editor__success">{{ profile.passwordSuccess }}</p>
        <div class="admin-confirm__actions admin-confirm__actions--start">
          <button class="button button--ghost" type="button" :disabled="profile.savingPassword" @click="profile.submitPassword">
            {{ profile.savingPassword ? '更新中...' : '更新密码' }}
          </button>
        </div>
      </div>
    </section>
  </section>
</template>
