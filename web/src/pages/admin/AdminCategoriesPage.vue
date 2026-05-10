<script setup lang="ts">
import { reactive } from 'vue'

import AppDialog from '@/components/AppDialog.vue'
import AdminDataTable from '@/components/AdminDataTable.vue'
import AdminPaginationControls from '@/components/AdminPaginationControls.vue'
import { useAdminCategoriesPage } from '@/composables/useAdminCategoriesPage'

const categories = reactive(useAdminCategoriesPage())
</script>

<template>
  <section class="admin-section admin-taxonomy-page">
    <header class="admin-page-heading">
      <div>
        <h2>分类管理</h2>
      </div>
    </header>

    <div class="admin-taxonomy-grid">
      <section class="panel admin-taxonomy-form">
        <div>
          <p class="panel__label">Add Category</p>
          <h3>添加分类</h3>
        </div>

        <label class="admin-form-field">
          <span>名称</span>
          <input v-model="categories.createForm.name" class="admin-input" type="text" placeholder="例如：开发" />
          <small>名称是它在您网站上的显示方式。</small>
        </label>

        <label class="admin-form-field">
          <span>别名</span>
          <input v-model="categories.createForm.slug" class="admin-input" type="text" placeholder="例如：development" />
          <small>「别名」是名称的 URL 友好版本。它通常都是小写的，并且只包含字母、数字和连字符。</small>
        </label>

        <label class="admin-form-field">
          <span>父级分类</span>
          <select v-model="categories.createForm.parentId" class="admin-select">
            <option value="">无</option>
            <option v-for="item in categories.parentOptions" :key="item.id" :value="String(item.id)">
              {{ categories.indentLabel(item) }}
            </option>
          </select>
          <small>分类和标签不同，它可以有层级关系。您可以有一个名为「音乐」的分类，在该分类下可以有名为「流行」和「古典」的子分类（完全可选）。</small>
        </label>

        <label class="admin-form-field">
          <span>描述</span>
          <textarea v-model="categories.createForm.desc" class="admin-textarea" rows="5" placeholder="描述默认不显示，但某些主题可能会显示。" />
        </label>

        <button class="button button--primary" type="button" :disabled="categories.saving" @click="categories.submitCreate">
          {{ categories.saving ? '提交中...' : '添加分类' }}
        </button>
      </section>

      <section class="panel admin-taxonomy-table">
        <AdminDataTable :panelized="false" :loading="categories.loading" :error-message="categories.errorMessage" :has-rows="categories.pagedCategories.length > 0" empty-text="当前还没有分类。" :colspan="4" @retry="categories.load">
          <template #toolbar>
            <div class="admin-posts__batch">
              <select v-model="categories.batchAction" class="admin-select">
                <option value="">选择批量操作</option>
                <option value="delete">删除</option>
              </select>
              <button class="button button--ghost" type="button" :disabled="!categories.hasSelection || !categories.batchAction" @click="categories.applyBatchAction">
                批量操作
              </button>
              <span class="admin-posts__selection">{{ categories.totalCount }} 项</span>
            </div>
          </template>
          <template #head>
            <tr>
              <th class="admin-table__checkbox">
                <input
                  type="checkbox"
                  :checked="categories.pagedCategories.filter((item) => !item.isDefault).length > 0 && categories.selectedIds.length === categories.pagedCategories.filter((item) => !item.isDefault).length"
                  @change="categories.toggleSelectAll"
                />
              </th>
              <th class="admin-table__col-title">
                <button class="admin-sort-button" type="button" @click="categories.updateSort('name')">名称</button>
              </th>
              <th>
                <button class="admin-sort-button" type="button" @click="categories.updateSort('slug')">别名</button>
              </th>
              <th>
                <button class="admin-sort-button" type="button" @click="categories.updateSort('postCount')">总数</button>
              </th>
            </tr>
          </template>
          <template #body>
            <tr v-for="category in categories.pagedCategories" :key="category.id">
              <td class="admin-table__checkbox">
                <input
                  type="checkbox"
                  :checked="categories.selectedIds.includes(category.id)"
                  :disabled="category.isDefault"
                  @change="categories.toggleSelection(category.id)"
                />
              </td>
              <td class="admin-table__col-title">
                <strong class="admin-taxonomy-table__name">{{ categories.indentLabel(category) }}</strong>
                <div class="admin-taxonomy-table__actions">
                  <button class="admin-link-button" type="button" @click="categories.openEdit(category)">编辑</button>
                  <template v-if="!category.isDefault">
                    <span>|</span>
                    <button class="admin-link-button admin-link-button--danger" type="button" @click="categories.requestDelete([category.id])">删除</button>
                  </template>
                  <template v-else>
                    <span>|</span>
                    <span>默认分类不可删除</span>
                  </template>
                </div>
                <p class="admin-taxonomy-table__desc">{{ category.desc || '—无描述' }}</p>
              </td>
              <td>{{ category.slug }}</td>
              <td>{{ category.postCount }}</td>
            </tr>
          </template>
          <template #footer>
            <AdminPaginationControls :page="categories.page" :total-pages="categories.totalPages" :total-count="categories.totalCount" @change="categories.goToPage" />
          </template>
        </AdminDataTable>
        <p class="panel__text admin-taxonomy-table__hint">删除分类不会删除分类中的文章。然而，仅隶属于已删除分类的文章将会分入默认分类 未分类 中。默认分类不能被删除。</p>
        <p class="panel__text admin-taxonomy-table__hint">分类可以选择性的转换成标签，请使用分类与标签转换器。</p>
      </section>
    </div>

    <AppDialog v-model="categories.editOpen" width="560px" panel-class="admin-dialog">
      <template #header>
        <div class="admin-dialog__header">
          <div>
            <p class="panel__label">Edit Category</p>
            <h3>编辑分类</h3>
          </div>
        </div>
      </template>

      <div class="admin-detail admin-detail--form">
        <label class="admin-form-field">
          <span>名称</span>
          <input v-model="categories.editForm.name" class="admin-input" type="text" />
        </label>
        <label class="admin-form-field">
          <span>别名</span>
          <input v-model="categories.editForm.slug" class="admin-input" type="text" />
        </label>
        <label class="admin-form-field">
          <span>父级分类</span>
          <select v-model="categories.editForm.parentId" class="admin-select">
            <option value="">无</option>
            <option v-for="item in categories.parentOptions" :key="item.id" :value="String(item.id)">
              {{ categories.indentLabel(item) }}
            </option>
          </select>
        </label>
        <label class="admin-form-field">
          <span>描述</span>
          <textarea v-model="categories.editForm.desc" class="admin-textarea" rows="4" />
        </label>
        <div class="admin-confirm__actions">
          <button class="button button--ghost" type="button" @click="categories.editOpen = false">取消</button>
          <button class="button button--primary" type="button" :disabled="categories.saving" @click="categories.submitEdit">
            {{ categories.saving ? '保存中...' : '保存修改' }}
          </button>
        </div>
      </div>
    </AppDialog>

    <AppDialog v-model="categories.confirmOpen" width="520px" panel-class="admin-dialog">
      <template #header>
        <div class="admin-dialog__header">
          <div>
            <p class="panel__label">Confirm</p>
            <h3>确认删除分类</h3>
          </div>
        </div>
      </template>

      <div class="admin-confirm">
          <p>本次将删除 {{ categories.selectedIds.length }} 个分类。当前操作来自统一分类数据源。</p>
        <p>仅隶属于已删除分类的文章将会分入默认分类“未分类”。</p>
        <div class="admin-confirm__actions">
          <button class="button button--ghost" type="button" :disabled="categories.saving" @click="categories.confirmOpen = false">取消</button>
          <button class="button button--danger" type="button" :disabled="categories.saving" @click="categories.confirmDelete">
            {{ categories.saving ? '处理中...' : '确认删除' }}
          </button>
        </div>
      </div>
    </AppDialog>
  </section>
</template>
