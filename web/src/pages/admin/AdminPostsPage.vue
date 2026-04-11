<script setup lang="ts">
import { reactive } from 'vue'

import AppDialog from '@/components/AppDialog.vue'
import { useAdminPostsPage } from '@/composables/useAdminPostsPage'

const posts = reactive(useAdminPostsPage())
</script>

<template>
  <section class="admin-section">
    <header class="panel admin-section__hero">
      <div>
        <p class="panel__label">Posts</p>
        <h2>文章管理</h2>
        <p class="panel__text">
        当前文章管理表已经接入统一数据源。支持分页、搜索、状态筛选、作者信息、审核状态、批量操作、确认对话框和详情弹窗。
        </p>
      </div>
      <RouterLink class="button button--primary" :to="{ name: 'admin-post-editor' }">写文章</RouterLink>
    </header>

    <section class="panel admin-posts">
      <div class="admin-posts__toolbar">
        <div class="admin-posts__filters">
          <input v-model="posts.keyword" class="admin-input" type="search" placeholder="搜索标题、作者、分类、标签" />
          <select v-model="posts.stateFilter" class="admin-select">
            <option value="all">全部状态</option>
            <option value="public">公开</option>
            <option value="private">私有 / 待审核</option>
          </select>
        </div>

        <div class="admin-posts__batch">
          <span class="admin-posts__selection">已选 {{ posts.selectedCount }} 篇</span>
          <button
            v-if="posts.authState.isAdmin"
            class="button button--ghost"
            type="button"
            :disabled="!posts.hasSelection"
            @click="posts.requestAction('pin', posts.selectedIds)"
          >
            批量置顶
          </button>
          <button
            v-if="posts.authState.isAdmin"
            class="button button--ghost"
            type="button"
            :disabled="!posts.hasSelection"
            @click="posts.requestAction('unpin', posts.selectedIds)"
          >
            取消置顶
          </button>
          <button
            v-if="posts.authState.isAdmin"
            class="button button--ghost"
            type="button"
            :disabled="!posts.hasSelection"
            @click="posts.requestAction('approve', posts.selectedIds)"
          >
            批量审核
          </button>
          <button class="button button--danger" type="button" :disabled="!posts.hasSelection" @click="posts.requestAction('delete', posts.selectedIds)">
            批量删除
          </button>
        </div>
      </div>

      <div v-if="posts.errorMessage" class="admin-posts__error">
        <p>{{ posts.errorMessage }}</p>
        <button class="button button--primary" type="button" @click="posts.load">重试</button>
      </div>

      <div v-else class="admin-table-wrap">
        <table class="admin-table">
          <thead>
            <tr>
              <th class="admin-table__checkbox">
                <input
                  type="checkbox"
                  :checked="posts.rows.length > 0 && posts.selectedIds.length === posts.rows.length"
                  @change="posts.toggleSelectAll"
                />
              </th>
              <th class="admin-table__col-title">文章</th>
              <th v-if="posts.authState.isAdmin" class="admin-table__col-author">作者</th>
              <th class="admin-table__col-status">状态</th>
              <th class="admin-table__col-audit">审核</th>
              <th class="admin-table__col-date">发布时间</th>
              <th>点赞</th>
              <th>浏览</th>
              <th>评论</th>
              <th class="admin-table__col-actions">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="posts.loading">
              <td :colspan="posts.authState.isAdmin ? 10 : 9" class="admin-table__empty">正在加载文章列表...</td>
            </tr>
            <tr v-else-if="posts.rows.length === 0">
              <td :colspan="posts.authState.isAdmin ? 10 : 9" class="admin-table__empty">当前筛选条件下没有文章。</td>
            </tr>
            <tr v-for="row in posts.rows" :key="row.id">
              <td class="admin-table__checkbox">
                <input type="checkbox" :checked="posts.selectedIds.includes(row.id)" @change="posts.toggleSelection(row.id)" />
              </td>
              <td class="admin-table__col-title">
                <button class="admin-posts__title" type="button" @click="posts.openDetail(row.id)">{{ row.title }}</button>
                <p class="admin-posts__desc">{{ row.desc }}</p>
                <div class="admin-posts__tags">
                  <span v-if="row.isPinned" class="admin-mini-chip">置顶</span>
                  <span class="admin-mini-chip">{{ row.category }}</span>
                  <span v-for="tag in row.tags" :key="tag" class="admin-mini-chip"># {{ tag }}</span>
                </div>
              </td>
              <td v-if="posts.authState.isAdmin" class="admin-table__col-author">
                <div class="admin-author">
                  <img :src="row.author.avatar" :alt="row.author.displayName" />
                  <div>
                    <strong>{{ row.author.displayName }}</strong>
                    <span>@{{ row.author.username }}</span>
                  </div>
                </div>
              </td>
              <td class="admin-table__col-status"><span :class="['admin-status-chip', `is-${row.state}`]">{{ posts.stateLabel(row.state) }}</span></td>
              <td class="admin-table__col-audit"><span :class="['admin-status-chip', `is-audit-${row.auditStatus}`]">{{ posts.auditLabel(row) }}</span></td>
              <td class="admin-table__col-date">{{ posts.formatDate(row.publishedAt) }}</td>
              <td>{{ row.likeCount }}</td>
              <td>{{ row.viewCount }}</td>
              <td>{{ row.commentCount }}</td>
              <td class="admin-table__col-actions">
                <div class="admin-posts__actions">
                  <RouterLink class="button button--ghost" :to="{ name: 'admin-post-editor', params: { id: String(row.id) } }">编辑</RouterLink>
                  <button class="button button--ghost" type="button" @click="posts.openDetail(row.id)">详情</button>
                  <button
                    v-if="posts.shouldShowPin(row)"
                    class="button button--ghost"
                    type="button"
                    @click="posts.requestAction('pin', [row.id])"
                  >
                    置顶
                  </button>
                  <button
                    v-if="posts.shouldShowUnpin(row)"
                    class="button button--ghost"
                    type="button"
                    @click="posts.requestAction('unpin', [row.id])"
                  >
                    取消置顶
                  </button>
                  <button
                    v-if="posts.shouldShowApprove(row)"
                    class="button button--ghost"
                    type="button"
                    @click="posts.requestAction('approve', [row.id])"
                  >
                    审核
                  </button>
                  <button class="button button--danger" type="button" @click="posts.requestAction('delete', [row.id])">删除</button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="admin-pagination">
        <div class="admin-pagination__summary">共 {{ posts.total }} 篇，第 {{ posts.page }} / {{ posts.totalPages }} 页</div>
        <div class="admin-pagination__controls">
          <button class="button button--ghost" type="button" :disabled="posts.page <= 1" @click="posts.goToPage(posts.page - 1)">上一页</button>
          <button
            v-for="pageNumber in posts.pageNumbers"
            :key="pageNumber"
            class="button"
            :class="pageNumber === posts.page ? 'button--primary' : 'button--ghost'"
            type="button"
            @click="posts.goToPage(pageNumber)"
          >
            {{ pageNumber }}
          </button>
          <button class="button button--ghost" type="button" :disabled="posts.page >= posts.totalPages" @click="posts.goToPage(posts.page + 1)">下一页</button>
          <div class="admin-pagination__jump">
            <input v-model="posts.jumpPageInput" class="admin-input admin-input--page" type="number" min="1" :max="posts.totalPages" />
            <button class="button button--ghost" type="button" @click="posts.jumpToPage">跳转</button>
          </div>
        </div>
      </div>
    </section>

    <AppDialog v-model="posts.detailOpen" width="760px" panel-class="admin-dialog">
      <template #header>
        <div class="admin-dialog__header">
          <div>
            <p class="panel__label">Post Detail</p>
            <h3>文章详情</h3>
          </div>
        </div>
      </template>

      <div v-if="posts.detailLoading" class="admin-dialog__empty">正在加载文章详情...</div>
      <div v-else-if="posts.activeDetail" class="admin-detail">
        <img class="admin-detail__cover" :src="posts.activeDetail.coverImage" :alt="posts.activeDetail.title" />
        <div class="admin-detail__header">
          <div>
            <h4>{{ posts.activeDetail.title }}</h4>
            <p class="panel__text">{{ posts.activeDetail.desc }}</p>
          </div>
          <div class="admin-detail__chips">
            <span :class="['admin-status-chip', `is-${posts.activeDetail.state}`]">{{ posts.stateLabel(posts.activeDetail.state) }}</span>
            <span :class="['admin-status-chip', `is-audit-${posts.activeDetail.auditStatus}`]">{{ posts.auditLabel(posts.activeDetail) }}</span>
          </div>
        </div>
        <div class="admin-detail__grid">
          <div class="admin-detail__item"><span>作者</span><strong>{{ posts.activeDetail.author.displayName }} @{{ posts.activeDetail.author.username }}</strong></div>
          <div class="admin-detail__item"><span>发布时间</span><strong>{{ posts.formatDate(posts.activeDetail.publishedAt) }}</strong></div>
          <div class="admin-detail__item"><span>更新时间</span><strong>{{ posts.formatDate(posts.activeDetail.updatedAt) }}</strong></div>
          <div class="admin-detail__item"><span>分类</span><strong>{{ posts.activeDetail.category }}</strong></div>
          <div class="admin-detail__item"><span>点赞</span><strong>{{ posts.activeDetail.likeCount }}</strong></div>
          <div class="admin-detail__item"><span>浏览</span><strong>{{ posts.activeDetail.viewCount }}</strong></div>
          <div class="admin-detail__item"><span>评论</span><strong>{{ posts.activeDetail.commentCount }}</strong></div>
          <div class="admin-detail__item"><span>阅读时长</span><strong>{{ posts.activeDetail.readingTime }} 分钟</strong></div>
          <div class="admin-detail__item"><span>字数</span><strong>{{ posts.activeDetail.wordCount }} 字</strong></div>
          <div class="admin-detail__item"><span>置顶</span><strong>{{ posts.activeDetail.isPinned ? '是' : '否' }}</strong></div>
          <div class="admin-detail__item"><span>标签</span><strong>{{ posts.activeDetail.tags.join(' / ') }}</strong></div>
        </div>
        <div class="admin-detail__actions">
          <RouterLink class="button button--ghost" :to="{ name: 'admin-post-editor', params: { id: String(posts.activeDetail.id) } }">编辑文章</RouterLink>
          <button
            v-if="posts.shouldShowPin(posts.activeDetail)"
            class="button button--ghost"
            type="button"
            @click="posts.requestAction('pin', [posts.activeDetail.id])"
          >
            设为置顶
          </button>
          <button
            v-if="posts.shouldShowUnpin(posts.activeDetail)"
            class="button button--ghost"
            type="button"
            @click="posts.requestAction('unpin', [posts.activeDetail.id])"
          >
            取消置顶
          </button>
          <button
            v-if="posts.shouldShowApprove(posts.activeDetail)"
            class="button button--ghost"
            type="button"
            @click="posts.requestAction('approve', [posts.activeDetail.id])"
          >
            审核通过
          </button>
          <button class="button button--danger" type="button" @click="posts.requestAction('delete', [posts.activeDetail.id])">删除</button>
        </div>
      </div>
      <div v-else class="admin-dialog__empty">没有找到这篇文章。</div>
    </AppDialog>

    <AppDialog v-model="posts.confirmOpen" width="520px" panel-class="admin-dialog">
      <template #header>
        <div class="admin-dialog__header">
          <div>
            <p class="panel__label">Confirm</p>
            <h3>{{ posts.confirmMeta?.title }}</h3>
          </div>
        </div>
      </template>

      <div class="admin-confirm">
        <p>{{ posts.confirmMeta?.description }}</p>
          <p>本次将处理 {{ posts.pendingIds.length }} 篇文章，当前操作来自统一文章数据源。</p>
        <div class="admin-confirm__actions">
          <button class="button button--ghost" type="button" :disabled="posts.actionLoading" @click="posts.closeConfirm">取消</button>
          <button class="button button--primary" type="button" :disabled="posts.actionLoading" @click="posts.confirmAction">
            {{ posts.actionLoading ? '处理中...' : posts.confirmMeta?.confirmText }}
          </button>
        </div>
      </div>
    </AppDialog>
  </section>
</template>
