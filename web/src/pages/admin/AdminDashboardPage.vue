<script setup lang="ts">
import { reactive } from 'vue'

import { useAdminDashboardPage } from '@/composables/useAdminDashboardPage'

const dashboard = reactive(useAdminDashboardPage())
</script>

<template>
  <section class="admin-section">
    <header class="panel admin-section__hero">
      <div>
        <p class="panel__label">Dashboard</p>
        <h2>仪表盘</h2>
        <p class="panel__text">后台总览已经走独立数据源，后续接后端时只需要替换 dashboard 数据实现。</p>
      </div>
      <div class="admin-session">
        <p class="panel__text">{{ dashboard.authState.user?.displayName }} / {{ dashboard.authState.user?.role }}</p>
        <p class="panel__text">access token: {{ dashboard.authComputed.token }}</p>
      </div>
    </header>

    <div v-if="dashboard.errorMessage" class="panel">
      <p class="panel__label">加载失败</p>
      <p class="panel__text">{{ dashboard.errorMessage }}</p>
      <button class="button button--primary" type="button" @click="dashboard.load">重试</button>
    </div>

    <template v-else>
      <section class="admin-stats">
        <article v-for="stat in dashboard.summary?.stats ?? []" :key="stat.label" class="panel admin-stat-card">
          <p class="panel__label">{{ stat.label }}</p>
          <strong>{{ stat.value }}</strong>
        </article>
      </section>

      <section v-if="!dashboard.loading" class="admin-grid">
        <article class="panel admin-card">
          <p class="panel__label">最近文章</p>
          <div v-if="(dashboard.summary?.recentPosts ?? []).length > 0" class="dashboard-recent-list">
            <article v-for="item in dashboard.summary?.recentPosts ?? []" :key="`${item.title}-${item.time}`" class="dashboard-recent-item">
              <strong>{{ item.title }}</strong>
              <div class="dashboard-recent-meta">
                <span>{{ item.author }}</span>
                <time>{{ item.time }}</time>
              </div>
            </article>
          </div>
          <p v-else class="panel__text">暂无最近文章。</p>
        </article>
        <article class="panel admin-card">
          <p class="panel__label">最近评论</p>
          <div v-if="(dashboard.summary?.recentComments ?? []).length > 0" class="dashboard-recent-list">
            <article v-for="item in dashboard.summary?.recentComments ?? []" :key="`${item.publisher}-${item.time}`" class="dashboard-recent-item">
              <strong>{{ item.content }}</strong>
              <div class="dashboard-recent-meta">
                <span>{{ item.publisher }}</span>
                <time>{{ item.time }}</time>
              </div>
            </article>
          </div>
          <p v-else class="panel__text">暂无最近评论。</p>
        </article>
      </section>
    </template>
  </section>
</template>
