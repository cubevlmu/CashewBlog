<script setup lang="ts">
import { reactive } from 'vue'

import AppDialog from '@/components/AppDialog.vue'
import AdminDataTable from '@/components/AdminDataTable.vue'
import AdminPaginationControls from '@/components/AdminPaginationControls.vue'
import { useAdminTagsPage } from '@/composables/useAdminTagsPage'

const tags = reactive(useAdminTagsPage())
</script>

<template>
  <section class="admin-section admin-taxonomy-page">
    <header class="admin-page-heading">
      <div>
        <h2>标签管理</h2>
        <p class="panel__text">参考 WordPress 标签管理布局，顶部新增标签，底部列表支持排序、批量操作、编辑和删除。</p>
      </div>
    </header>

    <div class="admin-taxonomy-grid">
      <section class="panel admin-taxonomy-form">
        <div>
          <p class="panel__label">Add Tag</p>
          <h3>添加标签</h3>
        </div>

        <label class="admin-form-field">
          <span>名称</span>
          <input v-model="tags.createForm.name" class="admin-input" type="text" placeholder="例如：开发" />
          <small>名称是它在您网站上的显示方式。</small>
        </label>

        <label class="admin-form-field">
          <span>别名</span>
          <input v-model="tags.createForm.slug" class="admin-input" type="text" placeholder="例如：development" />
          <small>「别名」是名称的 URL 友好版本。它通常都是小写的，并且只包含字母、数字和连字符。</small>
        </label>

        <label class="admin-form-field">
          <span>描述</span>
          <textarea v-model="tags.createForm.desc" class="admin-textarea" rows="5" placeholder="描述默认不显示，但某些主题可能会显示。" />
        </label>

        <button class="button button--primary" type="button" :disabled="tags.saving" @click="tags.submitCreate">
          {{ tags.saving ? '提交中...' : '添加标签' }}
        </button>
      </section>

      <section class="panel admin-taxonomy-table">
        <AdminDataTable :panelized="false" :loading="tags.loading" :error-message="tags.errorMessage" :has-rows="tags.pagedTags.length > 0" empty-text="当前还没有标签。" :colspan="4" @retry="tags.load">
          <template #toolbar>
            <div class="admin-posts__batch">
              <select v-model="tags.batchAction" class="admin-select">
                <option value="">选择批量操作</option>
                <option value="delete">删除</option>
              </select>
              <button class="button button--ghost" type="button" :disabled="!tags.hasSelection || !tags.batchAction" @click="tags.applyBatchAction">批量操作</button>
              <span class="admin-posts__selection">{{ tags.totalCount }} 项</span>
            </div>
          </template>
          <template #head>
            <tr>
              <th class="admin-table__checkbox">
                <input
                  type="checkbox"
                  :checked="tags.pagedTags.length > 0 && tags.selectedIds.length === tags.pagedTags.length"
                  @change="tags.toggleSelectAll"
                />
              </th>
              <th class="admin-table__col-title">
                <button class="admin-sort-button" type="button" @click="tags.updateSort('name')">名称</button>
              </th>
              <th>
                <button class="admin-sort-button" type="button" @click="tags.updateSort('slug')">别名</button>
              </th>
              <th>
                <button class="admin-sort-button" type="button" @click="tags.updateSort('postCount')">总数</button>
              </th>
            </tr>
          </template>
          <template #body>
            <tr v-for="tag in tags.pagedTags" :key="tag.id">
              <td class="admin-table__checkbox">
                <input type="checkbox" :checked="tags.selectedIds.includes(tag.id)" @change="tags.toggleSelection(tag.id)" />
              </td>
              <td class="admin-table__col-title">
                <strong class="admin-taxonomy-table__name">{{ tag.name }}</strong>
                <div class="admin-taxonomy-table__actions">
                  <button class="admin-link-button" type="button" @click="tags.openQuickEdit(tag)">编辑</button>
                  <span>|</span>
                  <button class="admin-link-button admin-link-button--danger" type="button" @click="tags.requestDelete([tag.id])">删除</button>
                </div>
                <p class="admin-taxonomy-table__desc">{{ tag.desc || '—无描述' }}</p>
              </td>
              <td>{{ tag.slug }}</td>
              <td>{{ tag.postCount }}</td>
            </tr>
          </template>
          <template #footer>
            <AdminPaginationControls :page="tags.page" :total-pages="tags.totalPages" :total-count="tags.totalCount" @change="tags.goToPage" />
          </template>
        </AdminDataTable>
        <p class="panel__text admin-taxonomy-table__hint">标签可以选择性地转换成分类，请使用分类与标签转换器。</p>
      </section>
    </div>

    <AppDialog v-model="tags.quickEditOpen" width="560px" panel-class="admin-dialog">
      <template #header>
        <div class="admin-dialog__header">
          <div>
            <p class="panel__label">Edit Tag</p>
            <h3>编辑标签</h3>
          </div>
        </div>
      </template>

      <div class="admin-detail admin-detail--form">
        <label class="admin-form-field">
          <span>名称</span>
          <input v-model="tags.quickEditForm.name" class="admin-input" type="text" />
        </label>
        <label class="admin-form-field">
          <span>别名</span>
          <input v-model="tags.quickEditForm.slug" class="admin-input" type="text" />
        </label>
        <label class="admin-form-field">
          <span>描述</span>
          <textarea v-model="tags.quickEditForm.desc" class="admin-textarea" rows="4" />
        </label>
        <div class="admin-confirm__actions">
          <button class="button button--ghost" type="button" @click="tags.quickEditOpen = false">取消</button>
          <button class="button button--primary" type="button" :disabled="tags.saving" @click="tags.submitQuickEdit">
            {{ tags.saving ? '保存中...' : '保存修改' }}
          </button>
        </div>
      </div>
    </AppDialog>

    <AppDialog v-model="tags.confirmOpen" width="520px" panel-class="admin-dialog">
      <template #header>
        <div class="admin-dialog__header">
          <div>
            <p class="panel__label">Confirm</p>
            <h3>确认删除标签</h3>
          </div>
        </div>
      </template>

      <div class="admin-confirm">
          <p>本次将删除 {{ tags.selectedIds.length }} 个标签。当前操作来自统一标签数据源。</p>
        <div class="admin-confirm__actions">
          <button class="button button--ghost" type="button" :disabled="tags.saving" @click="tags.confirmOpen = false">取消</button>
          <button class="button button--danger" type="button" :disabled="tags.saving" @click="tags.confirmDelete">
            {{ tags.saving ? '处理中...' : '确认删除' }}
          </button>
        </div>
      </div>
    </AppDialog>
  </section>
</template>
