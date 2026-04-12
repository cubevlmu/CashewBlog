<script setup lang="ts">
import type { AuthRole, AuthUser } from '@/types/auth'
import type { AdminUserRole } from '@/types/admin'

defineProps<{
  username?: string
  usernameDisabled?: boolean
  form: {
    username?: string
    displayName: string
    email: string
    avatar: string
    avatarId: number | null
    gender: AuthUser['gender']
    bio: string
    website: string
    role: AuthRole | AdminUserRole
  }
  canEditRole: boolean
  saving: boolean
  errorMessage?: string
  successMessage?: string
  submitText?: string
  compact?: boolean
}>()

defineEmits<{
  submit: []
}>()

function roleDisplayLabel(role: AuthRole | AdminUserRole) {
  if (role === 'admin') {
    return '管理员'
  }

  if (role === 'editor') {
    return '编辑'
  }

  return '普通用户'
}
</script>

<template>
  <div class="admin-profile-editor">
    <div class="admin-profile-editor__section">
      <div>
        <p class="panel__label">Name</p>
        <h3>个人资料</h3>
      </div>
      <div class="admin-profile-editor__grid">
        <label v-if="username !== undefined || form.username !== undefined" class="admin-form-field">
          <span>用户名</span>
          <input v-if="!usernameDisabled" v-model="form.username" class="admin-input" type="text" />
          <input v-else class="admin-input" type="text" :value="username" disabled />
          <small>{{ usernameDisabled ? '用户名当前为只读，后续接真实接口后如需修改可再放开。' : '用户名用于登录和用户唯一标识。' }}</small>
        </label>
        <label class="admin-form-field">
          <span>显示名称</span>
          <input v-model="form.displayName" class="admin-input" type="text" />
          <small>显示名称会出现在前台用户资料、评论和后台表格中。</small>
        </label>
        <label class="admin-form-field">
          <span>邮箱</span>
          <input v-model="form.email" class="admin-input" type="email" />
          <small>用于联系和登录通知。</small>
        </label>
        <label class="admin-form-field">
          <span>角色</span>
          <select v-if="canEditRole" v-model="form.role" class="admin-select">
            <option value="admin">管理员</option>
            <option value="editor">编辑</option>
            <option value="user">普通用户</option>
          </select>
          <input v-else class="admin-input" type="text" :value="roleDisplayLabel(form.role)" disabled />
          <small>{{ canEditRole ? '管理员可以调整当前用户的角色组。' : '普通用户不能修改自己的角色组。' }}</small>
        </label>
      </div>
    </div>

    <div class="admin-profile-editor__section">
      <div>
        <p class="panel__label">Contact</p>
        <h3>联系与展示</h3>
      </div>
      <div class="admin-profile-editor__grid">
        <label class="admin-form-field">
          <span>头像素材 ID</span>
          <input v-model.number="form.avatarId" class="admin-input" type="number" min="0" />
          <small>填写资源库素材 ID；留空或 0 表示不设置头像。</small>
        </label>
        <label class="admin-form-field">
          <span>性别</span>
          <select v-model="form.gender" class="admin-select">
            <option value="unknown">未设置</option>
            <option value="male">男</option>
            <option value="female">女</option>
          </select>
          <small>用于前台用户中心展示。</small>
        </label>
        <label class="admin-form-field admin-profile-editor__field--full">
          <span>个人网站</span>
          <input v-model="form.website" class="admin-input" type="url" placeholder="https://example.com" />
          <small>显示在用户资料中，可留空。</small>
        </label>
        <label class="admin-form-field admin-profile-editor__field--full">
          <span>个人简介</span>
          <textarea v-model="form.bio" class="admin-textarea" rows="5" />
          <small>简介会显示在前台用户中心卡片里。</small>
        </label>
      </div>
      <p v-if="errorMessage" class="login-form__error">{{ errorMessage }}</p>
      <p v-if="successMessage" class="admin-profile-editor__success">{{ successMessage }}</p>
      <div class="admin-confirm__actions admin-confirm__actions--start">
        <button class="button button--primary" type="button" :disabled="saving" @click="$emit('submit')">
          {{ saving ? '保存中...' : (submitText || '保存资料') }}
        </button>
      </div>
    </div>
  </div>
</template>
