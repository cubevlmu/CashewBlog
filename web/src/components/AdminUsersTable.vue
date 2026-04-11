<script setup lang="ts">
import AdminDataTable from '@/components/AdminDataTable.vue'
import AdminPaginationControls from '@/components/AdminPaginationControls.vue'
import type { AdminUserRecord } from '@/types/admin'

defineProps<{
  loading: boolean
  errorMessage: string
  users: AdminUserRecord[]
  selectedIds: number[]
  totalCount: number
  page: number
  totalPages: number
  isAdmin: boolean
  roleLabel: (role: AdminUserRecord['role']) => string
  formatLastLogin: (value: string) => string
  articleSummary: (user: AdminUserRecord) => string
}>()

defineEmits<{
  retry: []
  toggleSelectAll: []
  toggleSelection: [id: number]
  updateSort: [key: 'username' | 'email' | 'lastLoginAt']
  openEdit: [user: AdminUserRecord]
  openDetail: [id: number]
  requestDelete: [ids: number[]]
  changePage: [page: number]
}>()
</script>

<template>
  <AdminDataTable
    :loading="loading"
    :error-message="errorMessage"
    :has-rows="users.length > 0"
    empty-text="当前没有用户。"
    :colspan="7"
    @retry="$emit('retry')"
  >
    <template #toolbar>
      <div class="admin-posts__batch">
        <button
          v-if="isAdmin"
          class="button button--danger"
          type="button"
          :disabled="selectedIds.length === 0"
          @click="$emit('requestDelete', selectedIds)"
        >
          批量删除
        </button>
        <span class="admin-posts__selection">{{ totalCount }} 项</span>
      </div>
    </template>
    <template #head>
      <tr>
        <th class="admin-table__checkbox">
          <input
            type="checkbox"
            :checked="users.length > 0 && selectedIds.length === users.length"
            @change="$emit('toggleSelectAll')"
          />
        </th>
        <th class="admin-table__col-title">
          <button class="admin-sort-button" type="button" @click="$emit('updateSort', 'username')">用户名</button>
        </th>
        <th>显示名称</th>
        <th>
          <button class="admin-sort-button" type="button" @click="$emit('updateSort', 'email')">邮箱</button>
        </th>
        <th>角色</th>
        <th>文章</th>
        <th class="admin-table__col-date">
          <button class="admin-sort-button" type="button" @click="$emit('updateSort', 'lastLoginAt')">最近登录</button>
        </th>
      </tr>
    </template>
    <template #body>
      <tr v-for="user in users" :key="user.id">
        <td class="admin-table__checkbox">
          <input type="checkbox" :checked="selectedIds.includes(user.id)" @change="$emit('toggleSelection', user.id)" />
        </td>
        <td class="admin-table__col-title">
          <strong class="admin-taxonomy-table__name">{{ user.username }}</strong>
          <div class="admin-taxonomy-table__actions">
            <button class="admin-link-button" type="button" @click="$emit('openEdit', user)">编辑</button>
            <span>|</span>
            <button class="admin-link-button" type="button" @click="$emit('openDetail', user.id)">查看</button>
            <template v-if="isAdmin">
              <span>|</span>
              <button class="admin-link-button admin-link-button--danger" type="button" @click="$emit('requestDelete', [user.id])">删除</button>
            </template>
          </div>
        </td>
        <td>
          <div class="admin-author">
            <img :src="user.avatar" :alt="user.displayName" />
            <div>
              <strong>{{ user.displayName }}</strong>
              <span>@{{ user.username }}</span>
            </div>
          </div>
        </td>
        <td>{{ user.email }}</td>
        <td>{{ roleLabel(user.role) }}</td>
        <td>{{ articleSummary(user) }}</td>
        <td class="admin-table__col-date">{{ formatLastLogin(user.lastLoginAt) }}</td>
      </tr>
    </template>
    <template #footer>
      <AdminPaginationControls :page="page" :total-pages="totalPages" :total-count="totalCount" @change="$emit('changePage', $event)" />
    </template>
  </AdminDataTable>
</template>
