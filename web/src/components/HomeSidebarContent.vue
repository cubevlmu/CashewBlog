<script setup lang="ts">
import { useRouter } from 'vue-router'

import type { HomeConfig } from '@/types/site'

const props = defineProps<{
  config: HomeConfig
  searchKeyword: string
}>()

const router = useRouter()

const emit = defineEmits<{
  'update:searchKeyword': [value: string]
  openCategories: []
  openTags: []
}>()

function updateSearchKeyword(value: string) {
  emit('update:searchKeyword', value)
}

function openCategoriesPage() {
  void router.push({ name: 'categories' })
}

function openTagsPage() {
  void router.push({ name: 'tags' })
}

function submitSidebarSearch() {
  const keyword = props.searchKeyword.trim()
  if (!keyword) {
    return
  }

  void router.push({ name: 'search', query: { q: keyword } })
}

function getOwnerLinkIcon(icon?: string, text?: string) {
  const source = (icon?.trim() || text?.trim() || 'L').slice(0, 2)
  return source.toUpperCase()
}
</script>

<template>
  <div class="sidebar-stack">
    <article v-if="config.announcement" class="panel panel--announcement">
      <p class="panel__label">公告</p>
      <p class="panel__text panel__text--rich">{{ config.announcement }}</p>
    </article>

    <article class="panel">
      <p class="panel__label">站点简介</p>
      <h2>{{ config.intro.blogName }}</h2>
      <p class="panel__text">{{ config.intro.hitokoto }}</p>

      <div class="panel__search">
        <input
          :value="props.searchKeyword"
          class="admin-input"
          placeholder="再搜一次你感兴趣的内容"
          @input="updateSearchKeyword(($event.target as HTMLInputElement).value)"
          @keyup.enter="submitSidebarSearch"
        />
        <button class="button button--primary" type="button" @click="submitSidebarSearch">搜索</button>
      </div>
    </article>

    <article v-if="config.sidebar.customHtml.trim()" class="panel">
      <div class="panel__text panel__text--rich" v-html="config.sidebar.customHtml" />
    </article>

    <article class="panel owner-card">
      <div v-if="config.owner.name.trim()" class="owner-card__head">
        <img v-if="config.owner.avatar.trim()" class="owner-card__avatar" :src="config.owner.avatar" :alt="config.owner.name" />
        <h2>{{ config.owner.name }}</h2>
      </div>

      <p v-if="config.owner.name.trim() && config.owner.bio.trim()" class="panel__text">{{ config.owner.bio }}</p>

      <div class="owner-card__stats">
        <button class="metric-card" type="button">
          <span>{{ config.summary.postCount }}</span>
          <small>文章</small>
        </button>
        <button class="metric-card" type="button" @click="openCategoriesPage">
          <span>{{ config.summary.categoryCount }}</span>
          <small>分类</small>
        </button>
        <button class="metric-card" type="button" @click="openTagsPage">
          <span>{{ config.summary.tagCount }}</span>
          <small>标签</small>
        </button>
      </div>

      <div v-if="config.owner.links.length > 0" class="owner-card__links">
        <a
          v-for="link in config.owner.links"
          :key="`${link.text}-${link.link}`"
          class="owner-link"
          :href="link.link"
          target="_blank"
          rel="noreferrer"
        >
          <span class="owner-link__icon">{{ getOwnerLinkIcon(link.icon, link.text) }}</span>
          <span>{{ link.text }}</span>
        </a>
      </div>
    </article>
  </div>
</template>
