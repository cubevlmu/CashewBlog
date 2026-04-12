<script setup lang="ts">
import { reactive } from 'vue'

import AdminConfirmDialog from '@/components/AdminConfirmDialog.vue'
import AppDialog from '@/components/AppDialog.vue'
import AdminUserDetailPanel from '@/components/AdminUserDetailPanel.vue'
import AdminUserProfileEditor from '@/components/AdminUserProfileEditor.vue'
import AdminUsersTable from '@/components/AdminUsersTable.vue'
import { useAdminUsersPage } from '@/composables/useAdminUsersPage'

const users = reactive(useAdminUsersPage())
</script>

<template>
  <section class="admin-section admin-users-page">
    <header class="admin-page-heading">
      <div>
        <h2>用户管理</h2>
        <p class="panel__text">按用户名升序排列，支持查看显示名称、邮箱、角色、文章数和最近登录时间。</p>
      </div>
      <button v-if="users.authState.isAdmin" class="button button--primary" type="button" @click="users.openCreate">注册账户</button>
    </header>

    <section class="panel admin-taxonomy-table">
      <AdminUsersTable
        :panelized="false"
        :loading="users.loading"
        :error-message="users.errorMessage"
        :users="users.pagedUsers"
        :selected-ids="users.selectedIds"
        :total-count="users.totalCount"
        :page="users.page"
        :total-pages="users.totalPages"
        :is-admin="users.authState.isAdmin"
        :role-label="users.roleLabel"
        :format-last-login="users.formatLastLogin"
        :article-summary="users.articleSummary"
        @retry="users.load"
        @toggle-select-all="users.toggleSelectAll"
        @toggle-selection="users.toggleSelection"
        @update-sort="users.updateSort"
        @open-edit="users.openEdit"
        @open-detail="users.openDetail"
        @request-delete="users.requestDelete"
        @change-page="users.goToPage"
      />
    </section>

    <AppDialog v-model="users.editOpen" width="560px" panel-class="admin-dialog">
      <template #header>
        <div class="admin-dialog__header">
          <div>
            <p class="panel__label">Edit User</p>
            <h3>编辑用户</h3>
          </div>
        </div>
      </template>
      <AdminUserProfileEditor
        :username="users.editingUser?.username"
        :username-disabled="true"
        :form="users.editForm"
        :saving="users.saving"
        :can-edit-role="users.authState.isAdmin"
        :error-message="users.editError"
        :success-message="users.editSuccess"
        submit-text="保存修改"
        @submit="users.submitEdit"
      />
    </AppDialog>

    <AppDialog v-model="users.createOpen" width="560px" panel-class="admin-dialog">
      <template #header>
        <div class="admin-dialog__header">
          <div>
            <p class="panel__label">Create User</p>
            <h3>注册账户</h3>
          </div>
        </div>
      </template>
      <AdminUserProfileEditor
        :form="users.editForm"
        :username="users.editForm.username"
        :username-disabled="false"
        :saving="users.saving"
        :can-edit-role="users.authState.isAdmin"
        :error-message="users.editError"
        :success-message="users.editSuccess"
        submit-text="创建用户"
        @submit="users.submitEdit"
      />
    </AppDialog>

    <AppDialog v-model="users.detailOpen" width="620px" panel-class="admin-dialog">
      <template #header>
        <div class="admin-dialog__header">
          <div>
            <p class="panel__label">User Detail</p>
            <h3>用户详情</h3>
          </div>
        </div>
      </template>
      <AdminUserDetailPanel
        :loading="users.detailLoading"
        :user="users.activeDetail"
        :is-admin="users.authState.isAdmin"
        :role-label="users.roleLabel"
        :format-last-login="users.formatLastLogin"
        @edit="users.openEdit"
        @request-delete="users.requestDelete"
      />
    </AppDialog>

    <AppDialog v-model="users.confirmDeleteOpen" width="520px" panel-class="admin-dialog">
      <template #header>
        <div class="admin-dialog__header">
          <div>
            <p class="panel__label">Confirm</p>
            <h3>确认删除用户</h3>
          </div>
        </div>
      </template>
      <AdminConfirmDialog
        :description="`本次将删除 ${users.selectedIds.length} 个用户，该操作仅管理员可用。`"
        :loading="users.saving"
        confirm-text="确认删除"
        @cancel="users.confirmDeleteOpen = false"
        @confirm="users.confirmDelete"
      />
    </AppDialog>
  </section>
</template>
