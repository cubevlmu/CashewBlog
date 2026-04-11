<script setup lang="ts">
import { reactive } from 'vue'

import AppDialog from '@/components/AppDialog.vue'
import AdminDataTable from '@/components/AdminDataTable.vue'
import AdminPaginationControls from '@/components/AdminPaginationControls.vue'
import { useAdminAssetsPage } from '@/composables/useAdminAssetsPage'

const media = reactive(useAdminAssetsPage())
</script>

<template>
  <section class="admin-section admin-assets-page">
    <header class="admin-page-heading">
      <div>
        <h2>资源库</h2>
        <p class="panel__text">按日期降序显示资源文件，支持搜索、类型筛选、分页、详情查看、复制 URL 和删除。SEO 与压缩插件信息暂时忽略。</p>
      </div>
    </header>

    <section class="panel admin-taxonomy-table">
      <AdminDataTable
        :loading="media.loading"
        :error-message="media.errorMessage"
        :has-rows="media.pagedAssets.length > 0"
        empty-text="当前还没有资源文件。"
        :colspan="media.authState.isAdmin ? 5 : 4"
        @retry="media.load"
      >
        <template #toolbar>
          <div class="admin-posts__filters">
            <input v-model="media.keyword" class="admin-input" type="search" placeholder="搜索文件名和资源标题" />
            <select v-model="media.typeFilter" class="admin-select">
              <option value="image">图片</option>
              <option value="file">文件</option>
              <option value="all">全部类型</option>
            </select>
          </div>

          <div class="admin-posts__batch">
            <select class="admin-select">
              <option>选择批量操作</option>
              <option>删除</option>
            </select>
            <button class="button button--danger" type="button" :disabled="!media.hasSelection" @click="media.requestDelete(media.selectedIds, 'batch')">
              批量删除
            </button>
            <span class="admin-posts__selection">{{ media.totalCount }} 项</span>
          </div>
        </template>

        <template #head>
          <tr>
            <th class="admin-table__checkbox">
              <input
                type="checkbox"
                :checked="media.pagedAssets.length > 0 && media.selectedIds.length === media.pagedAssets.length"
                @change="media.toggleSelectAll"
              />
            </th>
            <th class="admin-table__col-title">
              <button class="admin-sort-button" type="button" :aria-label="media.sortMeta('title')" @click="media.updateSort('title')">文件</button>
            </th>
            <th v-if="media.authState.isAdmin" class="admin-table__col-author">
              <button class="admin-sort-button" type="button" :aria-label="media.sortMeta('author')" @click="media.updateSort('author')">作者</button>
            </th>
            <th class="admin-table__col-comments">
              <button class="admin-sort-button" type="button" :aria-label="media.sortMeta('commentCount')" @click="media.updateSort('commentCount')">评论</button>
            </th>
            <th class="admin-table__col-date">
              <button class="admin-sort-button" type="button" :aria-label="media.sortMeta('uploadedAt')" @click="media.updateSort('uploadedAt')">日期</button>
            </th>
          </tr>
        </template>

        <template #body>
          <tr v-for="asset in media.pagedAssets" :key="asset.id">
            <td class="admin-table__checkbox">
              <input type="checkbox" :checked="media.selectedIds.includes(asset.id)" @change="media.toggleSelection(asset.id)" />
            </td>
            <td class="admin-table__col-title">
              <div class="admin-asset-card">
                <img class="admin-asset-card__thumb" :src="asset.thumbnailUrl" :alt="asset.title" />
                <div class="admin-asset-card__body">
                  <strong class="admin-taxonomy-table__name">{{ asset.title }}</strong>
                  <p class="admin-asset-card__filename">文件名：{{ asset.fileName }}</p>
                  <div class="admin-taxonomy-table__actions">
                    <button class="admin-link-button" type="button" @click="media.openDetail(asset.id)">编辑</button>
                    <span>|</span>
                    <button class="admin-link-button admin-link-button--danger" type="button" @click="media.requestDelete([asset.id])">永久删除</button>
                    <span>|</span>
                    <a class="admin-link-button" :href="asset.fileUrl" target="_blank" rel="noreferrer">查看</a>
                    <span>|</span>
                    <button class="admin-link-button" type="button" @click="media.copyUrl(asset.fileUrl)">复制 URL</button>
                    <span>|</span>
                    <a class="admin-link-button" :href="asset.fileUrl" download>下载文件</a>
                  </div>
                </div>
              </div>
            </td>
            <td v-if="media.authState.isAdmin" class="admin-table__col-author">
              <div class="admin-author">
                <img :src="asset.author.avatar" :alt="asset.author.displayName" />
                <div>
                  <strong>{{ asset.author.displayName }}</strong>
                  <span>@{{ asset.author.username }}</span>
                </div>
              </div>
            </td>
            <td class="admin-table__col-comments">{{ asset.commentCount > 0 ? `${asset.commentCount} 条评论` : '—无评论' }}</td>
            <td class="admin-table__col-date">{{ media.formatDate(asset.uploadedAt) }}</td>
          </tr>
        </template>

        <template #footer>
          <AdminPaginationControls :page="media.page" :total-pages="media.totalPages" :total-count="media.totalCount" @change="media.goToPage" />
        </template>
      </AdminDataTable>
    </section>

    <AppDialog v-model="media.detailOpen" width="720px" panel-class="admin-dialog">
      <template #header>
        <div class="admin-dialog__header">
          <div>
            <p class="panel__label">Asset Detail</p>
            <h3>资源详情</h3>
          </div>
        </div>
      </template>

      <div v-if="media.detailLoading" class="admin-dialog__empty">正在加载资源详情...</div>
      <div v-else-if="media.activeDetail" class="admin-detail admin-detail--asset">
        <img class="admin-detail__cover admin-detail__cover--asset" :src="media.activeDetail.fileUrl" :alt="media.activeDetail.title" />
        <div class="admin-detail__header">
          <div>
            <h4>{{ media.activeDetail.title }}</h4>
            <p class="panel__text">{{ media.activeDetail.fileName }}</p>
          </div>
        </div>
        <div class="admin-detail__grid">
          <div v-if="media.authState.isAdmin" class="admin-detail__item"><span>作者</span><strong>{{ media.activeDetail.author.displayName }}</strong></div>
          <div class="admin-detail__item"><span>上传时间</span><strong>{{ media.formatDateTime(media.activeDetail.uploadedAt) }}</strong></div>
          <div class="admin-detail__item"><span>MIME</span><strong>{{ media.activeDetail.mimeType }}</strong></div>
          <div class="admin-detail__item"><span>文件大小</span><strong>{{ media.activeDetail.fileSizeLabel }}</strong></div>
          <div class="admin-detail__item"><span>评论数</span><strong>{{ media.activeDetail.commentCount }}</strong></div>
          <div class="admin-detail__item"><span>Alt</span><strong>{{ media.activeDetail.alt || '—' }}</strong></div>
          <div class="admin-detail__item"><span>描述</span><strong>{{ media.activeDetail.description || '—' }}</strong></div>
        </div>
        <div class="admin-detail__actions">
          <button class="button button--ghost" type="button" @click="media.copyUrl(media.activeDetail.fileUrl)">复制 URL</button>
          <a class="button button--ghost" :href="media.activeDetail.fileUrl" target="_blank" rel="noreferrer">查看资源</a>
          <a class="button button--ghost" :href="media.activeDetail.fileUrl" download>下载文件</a>
          <button class="button button--danger" type="button" @click="media.requestDelete([media.activeDetail.id])">永久删除</button>
        </div>
      </div>
      <div v-else class="admin-dialog__empty">没有找到这个资源。</div>
    </AppDialog>

    <AppDialog v-model="media.confirmOpen" width="520px" panel-class="admin-dialog">
      <template #header>
        <div class="admin-dialog__header">
          <div>
            <p class="panel__label">Confirm</p>
            <h3>确认删除资源</h3>
          </div>
        </div>
      </template>

      <div class="admin-confirm">
        <p>本次将删除 {{ media.selectedIds.length }} 个资源文件。</p>
          <p>{{ media.actionScope === 'batch' ? '当前为批量删除流程。' : '当前为单个资源删除流程。' }} 当前结果来自统一资源数据源。</p>
        <div class="admin-confirm__actions">
          <button class="button button--ghost" type="button" :disabled="media.saving" @click="media.confirmOpen = false">取消</button>
          <button class="button button--danger" type="button" :disabled="media.saving" @click="media.confirmDelete">
            {{ media.saving ? '处理中...' : '确认删除' }}
          </button>
        </div>
      </div>
    </AppDialog>
  </section>
</template>
