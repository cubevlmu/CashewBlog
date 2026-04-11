<script setup lang="ts">
import type { AdminUserRecord } from '@/types/admin'

defineProps<{
  loading: boolean
  user: AdminUserRecord | null
  isAdmin: boolean
  roleLabel: (role: AdminUserRecord['role']) => string
  formatLastLogin: (value: string) => string
}>()

defineEmits<{
  edit: [user: AdminUserRecord]
  requestDelete: [ids: number[]]
}>()
</script>

<template>
  <div v-if="loading" class="admin-dialog__empty">正在加载用户详情...</div>
  <div v-else-if="user" class="admin-detail">
    <div class="admin-detail__header">
      <div class="admin-author admin-author--large">
        <img :src="user.avatar" :alt="user.displayName" />
        <div>
          <h4>{{ user.displayName }}</h4>
          <p class="panel__text">@{{ user.username }}</p>
        </div>
      </div>
    </div>
    <div class="admin-detail__grid">
      <div class="admin-detail__item"><span>邮箱</span><strong>{{ user.email }}</strong></div>
      <div class="admin-detail__item"><span>角色</span><strong>{{ roleLabel(user.role) }}</strong></div>
      <div class="admin-detail__item"><span>文章数</span><strong>{{ user.postCount }}</strong></div>
      <div class="admin-detail__item"><span>最近登录</span><strong>{{ formatLastLogin(user.lastLoginAt) }}</strong></div>
    </div>
    <div class="admin-detail__actions">
      <button class="button button--ghost" type="button" @click="$emit('edit', user)">编辑</button>
      <button v-if="isAdmin" class="button button--danger" type="button" @click="$emit('requestDelete', [user.id])">删除用户</button>
    </div>
  </div>
  <div v-else class="admin-dialog__empty">没有找到这个用户。</div>
</template>
