<script setup lang="ts">
import { reactive } from 'vue'

import AppDialog from '@/components/AppDialog.vue'
import AdminDataTable from '@/components/AdminDataTable.vue'
import AdminPaginationControls from '@/components/AdminPaginationControls.vue'
import UserAvatar from '@/components/UserAvatar.vue'
import { useAdminCommentsPage } from '@/composables/useAdminCommentsPage'

const comments = reactive(useAdminCommentsPage())
</script>

<template>
  <section class="admin-section">
    <header class="admin-page-heading">
      <div>
        <h2>评论管理</h2>
        <p class="panel__text">按评论日期降序排列，支持作者、评论内容、回复至、提交时间展示，以及批量审核、隐藏和删除。</p>
      </div>
    </header>

    <section class="panel admin-taxonomy-table">
      <AdminDataTable :loading="comments.loading" :error-message="comments.errorMessage" :has-rows="comments.pagedComments.length > 0" empty-text="无评论。" :colspan="5" @retry="comments.load">
        <template #toolbar>
          <div class="admin-posts__batch">
            <select class="admin-select">
              <option>选择批量操作</option>
              <option v-if="comments.authState.isAdmin">审核通过</option>
              <option>隐藏</option>
              <option>删除</option>
            </select>
            <button
              v-if="comments.authState.isAdmin"
              class="button button--ghost"
              type="button"
              :disabled="!comments.hasSelection"
              @click="comments.requestAction('approve', comments.selectedIds)"
            >
              审核
            </button>
            <button class="button button--ghost" type="button" :disabled="!comments.hasSelection" @click="comments.requestAction('hide', comments.selectedIds)">隐藏</button>
            <button class="button button--danger" type="button" :disabled="!comments.hasSelection" @click="comments.requestAction('delete', comments.selectedIds)">删除</button>
          </div>
        </template>
        <template #head>
          <tr>
            <th class="admin-table__checkbox">
              <input
                type="checkbox"
                :checked="comments.pagedComments.length > 0 && comments.selectedIds.length === comments.pagedComments.length"
                @change="comments.toggleSelectAll"
              />
            </th>
            <th class="admin-table__col-author">作者</th>
            <th class="admin-table__col-title">评论</th>
            <th class="admin-table__col-status">回复至</th>
            <th class="admin-table__col-date">提交于</th>
          </tr>
        </template>
        <template #body>
          <tr v-for="comment in comments.pagedComments" :key="comment.id">
                <td class="admin-table__checkbox">
                  <input type="checkbox" :checked="comments.selectedIds.includes(comment.id)" @change="comments.toggleSelection(comment.id)" />
                </td>
                <td class="admin-table__col-author">
                  <div class="admin-author">
                    <UserAvatar :src="comment.avatar" :alt="comment.author" />
                    <div>
                      <strong>{{ comment.author }}</strong>
                      <span>{{ comment.authorEmail }}</span>
                    </div>
                  </div>
                </td>
                <td class="admin-table__col-title">
                  <p class="admin-posts__desc">{{ comment.content }}</p>
                  <div class="admin-taxonomy-table__actions">
                    <span class="admin-status-chip" :class="`is-audit-${comment.state === 'approved' ? 'approved' : 'pending'}`">{{ comments.stateLabel(comment.state) }}</span>
                    <span>|</span>
                    <span>{{ comment.postTitle }}</span>
                    <span>|</span>
                    <button
                      v-if="comments.authState.isAdmin && comment.state !== 'approved'"
                      class="admin-link-button"
                      type="button"
                      @click="comments.requestAction('approve', [comment.id])"
                    >
                      审核
                    </button>
                    <button
                      v-if="comment.state === 'hidden'"
                      class="admin-link-button"
                      type="button"
                      @click="comments.requestAction('restore', [comment.id])"
                    >
                      恢复
                    </button>
                    <button v-else class="admin-link-button" type="button" @click="comments.requestAction('hide', [comment.id])">隐藏</button>
                    <button class="admin-link-button admin-link-button--danger" type="button" @click="comments.requestAction('delete', [comment.id])">删除</button>
                  </div>
                </td>
                <td class="admin-table__col-status">{{ comment.replyTo || '—' }}</td>
                <td class="admin-table__col-date">{{ comments.formatDate(comment.submittedAt) }}</td>
          </tr>
        </template>
        <template #footer>
          <AdminPaginationControls :page="comments.page" :total-pages="comments.totalPages" :total-count="comments.totalCount" @change="comments.goToPage" />
        </template>
      </AdminDataTable>
    </section>

    <AppDialog v-model="comments.confirmOpen" width="520px" panel-class="admin-dialog">
      <template #header>
        <div class="admin-dialog__header">
          <div>
            <p class="panel__label">Confirm</p>
            <h3>确认批量操作</h3>
          </div>
        </div>
      </template>

      <div class="admin-confirm">
          <p>本次将处理 {{ comments.selectedIds.length }} 条评论，当前操作来自统一评论数据源。</p>
        <div class="admin-confirm__actions">
          <button class="button button--ghost" type="button" :disabled="comments.saving" @click="comments.confirmOpen = false">取消</button>
          <button class="button button--primary" type="button" :disabled="comments.saving" @click="comments.confirmAction">
            {{ comments.saving ? '处理中...' : '确认操作' }}
          </button>
        </div>
      </div>
    </AppDialog>
  </section>
</template>
