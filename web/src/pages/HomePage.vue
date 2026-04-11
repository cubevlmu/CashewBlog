<script setup lang="ts">
import { defineAsyncComponent, reactive } from 'vue'
import { useRoute } from 'vue-router'

import HomeNavbar from '@/components/HomeNavbar.vue'
import HomeSidebarContent from '@/components/HomeSidebarContent.vue'
import PostFeedCard from '@/components/PostFeedCard.vue'
import { useHomePage } from '@/composables/useHomePage'

const ArticlePage = defineAsyncComponent(() => import('@/pages/ArticlePage.vue'))
const SearchPage = defineAsyncComponent(() => import('@/pages/SearchPage.vue'))
const TaxonomyPage = defineAsyncComponent(() => import('@/pages/TaxonomyPage.vue'))
const UserPage = defineAsyncComponent(() => import('@/pages/UserPage.vue'))
const SearchOverlay = defineAsyncComponent(() => import('@/components/SearchOverlay.vue'))
const TaxonomyDialog = defineAsyncComponent(() => import('@/components/TaxonomyDialog.vue'))

const route = useRoute()
const home = reactive(useHomePage())
</script>

<template>
  <div class="home-page">
    <template v-if="home.homeConfig">
      <HomeNavbar :config="home.homeConfig.navbar" :show-info-menu="true" @open-search="home.openSearch()">
        <template #info-panel>
          <HomeSidebarContent
            :config="home.homeConfig"
            :search-keyword="home.searchKeyword"
            @update:search-keyword="home.searchKeyword = $event"
            @open-search="home.openSearch"
            @open-categories="home.dialogType = 'categories'"
            @open-tags="home.dialogType = 'tags'"
          />
        </template>
      </HomeNavbar>

      <section class="home-hero" :style="home.heroStyle">
        <img class="home-hero__bg-fallback" :src="home.heroImageUrl" alt="" @error="home.imageFallback = true" />

        <div class="container home-hero__inner">
          <div class="home-hero__copy">
            <h1 :class="{ 'is-typing': home.homeConfig.header.animation }">
              {{ home.heroTitleDisplay }}
            </h1>
            <p class="home-hero__subtitle">{{ home.homeConfig.header.subtitle }}</p>
          </div>
        </div>
      </section>

      <section class="home-main">
        <div class="container home-main__grid">
          <aside class="home-sidebar">
            <div class="home-sidebar__inner">
              <HomeSidebarContent
                :config="home.homeConfig"
                :search-keyword="home.searchKeyword"
                @update:search-keyword="home.searchKeyword = $event"
                @open-search="home.openSearch"
                @open-categories="home.dialogType = 'categories'"
                @open-tags="home.dialogType = 'tags'"
              />
            </div>
          </aside>

          <section id="home-feed" class="home-feed">
            <div ref="home.contentTop" class="content-top-anchor" />
            <Transition name="content-switch" mode="out-in">
              <ArticlePage
                v-if="home.isArticleRoute"
                :key="route.fullPath"
                :article-id="home.currentArticleId"
                :preview-post="home.previewPost"
                class="home-content-view"
                @back="home.handleBackToFeed"
              />

              <SearchPage
                v-else-if="home.isSearchRoute"
                :key="route.fullPath"
                embedded
                class="home-content-view"
              />

              <TaxonomyPage
                v-else-if="home.isTaxonomyRoute"
                :key="route.fullPath"
                embedded
                class="home-content-view"
              />

              <UserPage
                v-else-if="home.isUserRoute"
                :key="route.fullPath"
                embedded
                class="home-content-view"
              />

              <div v-else :key="`feed-${route.fullPath}`" class="home-content-view">
                <div v-if="home.loading" class="feed-skeleton">
                  <div v-for="index in 3" :key="index" class="feed-skeleton__item" />
                </div>

                <div v-else-if="home.feedError && home.posts.length === 0 && home.pinnedPosts.length === 0" class="panel home-error">
                  <p class="panel__label">加载失败</p>
                  <h2>首页内容暂时不可用</h2>
                  <p class="panel__text">{{ home.feedError }}</p>
                  <button class="button button--primary" type="button" @click="home.loadHome">重试</button>
                </div>

                <template v-else>
                  <section v-if="home.pinnedPosts.length > 0" class="feed-section">
                    <div class="feed-section__heading">
                      <div>
                        <p class="eyebrow">Pinned Posts</p>
                        <h2>置顶推荐</h2>
                      </div>
                    </div>
                    <div class="feed-grid feed-grid--pinned">
                      <div v-for="post in home.pinnedPosts" :key="post.id">
                        <PostFeedCard :post="post" @select="home.handleArticleSelect" />
                      </div>
                    </div>
                  </section>

                  <section class="feed-section">
                    <div class="feed-section__heading">
                      <div>
                        <p class="eyebrow">Latest Posts</p>
                        <h2>最新文章流</h2>
                      </div>
                    </div>

                    <div v-if="home.posts.length > 0" class="feed-grid">
                      <div v-for="post in home.posts" :key="post.id">
                        <PostFeedCard :post="post" @select="home.handleArticleSelect" />
                      </div>
                    </div>
                    <div v-else class="panel">
                      <p class="empty-state">当前还没有公开文章。</p>
                    </div>

                    <div ref="home.sentinel" class="feed-sentinel" />

                    <p v-if="home.feedLoading" class="feed-status">正在加载更多文章...</p>
                    <div v-if="home.feedError && home.posts.length > 0" class="feed-inline-error">
                      <span>{{ home.feedError }}</span>
                      <button class="button button--ghost" type="button" @click="home.loadMore">重试</button>
                    </div>
                    <p v-if="!home.hasMore && home.posts.length > 0" class="feed-status">已经到底了。</p>
                  </section>
                </template>
              </div>
            </Transition>
          </section>
        </div>
      </section>
    </template>

    <div v-else-if="home.loading" class="container">
      <div class="feed-skeleton">
        <div v-for="index in 4" :key="index" class="feed-skeleton__item" />
      </div>
    </div>

    <SearchOverlay
      :open="home.searchOpen"
      :initial-value="home.searchKeyword"
      @close="home.searchOpen = false"
      @submit="home.submitSearch"
    />
    <TaxonomyDialog
      v-if="home.dialogType !== null"
      :open="true"
      :items="home.activeDialogItems"
      :title="home.activeDialogTitle"
      :type="home.dialogType ?? 'tags'"
      @close="home.dialogType = null"
    />
  </div>
</template>
