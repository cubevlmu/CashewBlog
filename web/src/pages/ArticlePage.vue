<script setup lang="ts">
import { computed, ref, toRef, watch } from 'vue'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
import {
  faArrowLeft,
  faArrowRight,
  faClock,
  faEye,
  faComments,
  faBookmark,
  faFileLines,
  faHourglassHalf,
  faSpinner,
} from '@fortawesome/free-solid-svg-icons'

import { usePostDetail } from '@/composables/usePostDetail'
import UserAvatar from '@/components/UserAvatar.vue'
import type { HomePostCard } from '@/types/site'

const fallbackCoverImage = '/default-cover.svg'

const props = defineProps<{
  articleId: number | null
  previewPost?: HomePostCard | null
}>()

defineEmits<{
  back: []
}>()

const {
  loading,
  loadError,
  replyValue,
  activeReplyId,
  replyDraft,
  isLoggedIn,
  activePost,
  comments,
  pagedComments,
  commentsPage,
  commentsTotalPages,
  previousPost,
  nextPost,
  hasPostNavigation,
  formattedDate,
  currentUser,
  renderedContent,
  submitError,
  goToLogin,
  logoutCurrentUser,
  openReply,
  submitComment,
  submitReply,
  goToPreviousCommentsPage,
  goToNextCommentsPage,
  load,
} = usePostDetail(toRef(props, 'articleId'), toRef(props, 'previewPost'))

const coverLoadError = ref(false)

const displayedCoverImage = computed(() =>
  coverLoadError.value || !activePost.value?.coverImage ? fallbackCoverImage : activePost.value.coverImage,
)

watch(
  () => activePost.value?.coverImage,
  () => {
    coverLoadError.value = false
  },
)
</script>

<template>
  <section class="article-panel">
    <div v-if="loading && !activePost" class="article-page__loading article-page__loading--full">
      <FontAwesomeIcon :icon="faSpinner" class="article-page__loading-icon" />
      <p class="article-page__loading-copy">加载文章...</p>
    </div>

    <div v-else-if="activePost" class="article-page">
      <div class="article-page__cover-shell">
        <img class="article-page__cover" :src="displayedCoverImage" :alt="activePost.title" @error="coverLoadError = true" />
      </div>
      <header class="article-page__header">
        <div class="article-page__title-row">
          <button class="article-page__back" type="button" aria-label="返回文章流" @click="$emit('back')">
            <FontAwesomeIcon :icon="faArrowLeft" />
          </button>
          <h1 class="article-page__title">{{ activePost.title }}</h1>
        </div>
        <div class="article-page__meta article-page__meta--header">
          <span class="article-page__meta-item article-page__author">
            <UserAvatar :src="activePost.author.avatar" :alt="activePost.author.displayName" size="xs" shape="rounded" />
            <span>{{ activePost.author.displayName }}</span>
          </span>
          <span class="article-page__meta-item">
            <FontAwesomeIcon :icon="faClock" />
            <span>{{ formattedDate }}</span>
          </span>
          <span class="article-page__meta-item">
            <FontAwesomeIcon :icon="faEye" />
            <span>{{ activePost.viewCount }}</span>
          </span>
          <span class="article-page__meta-item">
            <FontAwesomeIcon :icon="faComments" />
            <span>{{ activePost.commentCount }}</span>
          </span>
          <RouterLink
            v-if="activePost.category.slug"
            class="article-page__meta-item article-page__meta-link"
            :to="{ name: 'category', params: { slug: activePost.category.slug } }"
          >
            <FontAwesomeIcon :icon="faBookmark" />
            <span>{{ activePost.category.name }}</span>
          </RouterLink>
          <span v-else class="article-page__meta-item">
            <FontAwesomeIcon :icon="faBookmark" />
            <span>{{ activePost.category.name }}</span>
          </span>
          <span class="article-page__meta-item">
            <FontAwesomeIcon :icon="faFileLines" />
            <span>{{ activePost.wordCount }} 字</span>
          </span>
          <span class="article-page__meta-item">
            <FontAwesomeIcon :icon="faHourglassHalf" />
            <span>{{ activePost.readingTime }} 分钟</span>
          </span>
        </div>
      </header>
      <div class="article-page__tags">
        <template v-for="tag in activePost.tags" :key="tag.slug || tag.name">
          <RouterLink
            v-if="tag.slug"
            class="article-page__tag"
            :to="{ name: 'tag', params: { slug: tag.slug } }"
          >
            # {{ tag.name }}
          </RouterLink>
          <span v-else class="article-page__tag article-page__tag--inactive"># {{ tag.name }}</span>
        </template>
      </div>
      <article class="article-page__content" :class="{ 'is-loading': loading }">
        <div v-if="loading" class="article-page__loading">
          <FontAwesomeIcon :icon="faSpinner" class="article-page__loading-icon" />
          <p class="article-page__loading-copy">{{ activePost.desc }}</p>
        </div>
        <div class="article-page__markdown" v-html="renderedContent" />
      </article>

      <div v-if="hasPostNavigation" class="post-navigation card shadow-sm">
        <div class="post-navigation-item post-navigation-pre">
          <template v-if="previousPost">
            <span class="page-navigation-extra-text">
              <FontAwesomeIcon :icon="faArrowLeft" />
              上一篇
            </span>
            <RouterLink :to="`/article/${previousPost.id}`">{{ previousPost.title }}</RouterLink>
          </template>
        </div>
        <div class="post-navigation-item post-navigation-next">
          <template v-if="nextPost">
            <span class="page-navigation-extra-text">
              下一篇
              <FontAwesomeIcon :icon="faArrowRight" />
            </span>
            <RouterLink :to="`/article/${nextPost.id}`">{{ nextPost.title }}</RouterLink>
          </template>
        </div>
      </div>

      <template v-if="activePost.allowComment">
      <section class="comment-panel panel">
        <div class="comment-panel__header">
          <div>
            <p class="panel__label">评论区</p>
            <h2>评论与回复</h2>
          </div>
          <div class="comment-panel__auth">
            <span v-if="isLoggedIn" class="comment-panel__user">当前登录：{{ currentUser?.displayName }}</span>
            <button v-if="isLoggedIn" class="button button--ghost" type="button" @click="logoutCurrentUser">
              退出登录
            </button>
            <button v-else class="button button--ghost" type="button" @click="goToLogin">
              去登录
            </button>
          </div>
        </div>

        <div class="comment-form" :class="{ 'is-disabled': !isLoggedIn }">
          <textarea
            v-model="replyValue"
            class="comment-form__textarea"
            :disabled="!isLoggedIn"
            :placeholder="isLoggedIn ? '输入你的评论内容' : '未登录时无法评论，请先登录'"
          />
          <div class="comment-form__actions">
            <span class="comment-form__hint">
              {{ isLoggedIn ? '已登录，可以直接发表评论或回复。' : '登录后即可评论与回复。' }}
            </span>
            <button class="button button--primary" type="button" :disabled="!isLoggedIn" @click="submitComment">
              回复
            </button>
          </div>
        </div>

        <p v-if="submitError" class="login-form__error">{{ submitError }}</p>

        <div class="comment-list">
          <article v-for="comment in pagedComments" :key="comment.id" class="comment-item">
            <UserAvatar :src="comment.avatar" :alt="comment.author" size="md" shape="rounded" />
            <div class="comment-item__body">
              <div class="comment-item__meta">
                <strong>{{ comment.author }}</strong>
                <span>{{ new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(comment.createdAt)) }}</span>
              </div>
              <p v-if="comment.replyTo" class="comment-item__reply">回复 {{ comment.replyTo }}</p>
              <p class="comment-item__content">{{ comment.content }}</p>
              <button class="comment-item__action" type="button" :disabled="!isLoggedIn" @click="openReply(comment.id)">回复</button>
              <div v-if="activeReplyId === comment.id" class="comment-reply-box">
                <textarea
                  v-model="replyDraft"
                  class="comment-form__textarea comment-reply-box__textarea"
                  :placeholder="`回复 ${comment.author}`"
                />
                <div class="comment-reply-box__actions">
                  <button class="button button--ghost" type="button" @click="activeReplyId = null; replyDraft = ''">
                    取消
                  </button>
                  <button class="button button--primary" type="button" @click="submitReply(comment.id, comment.author)">
                    提交回复
                  </button>
                </div>
              </div>
            </div>
          </article>
        </div>

        <div v-if="comments.length > 0" class="comment-pagination">
          <span class="comment-pagination__summary">第 {{ commentsPage }} / {{ commentsTotalPages }} 页</span>
          <div class="comment-pagination__actions">
            <button class="button button--ghost" type="button" :disabled="commentsPage <= 1" @click="goToPreviousCommentsPage">
              上一页
            </button>
            <button
              class="button button--ghost"
              type="button"
              :disabled="commentsPage >= commentsTotalPages"
              @click="goToNextCommentsPage"
            >
              下一页
            </button>
          </div>
        </div>
      </section>
      </template>
      <div v-else class="comment-panel panel">
        <p class="panel__label">评论区</p>
        <h2>评论已关闭</h2>
        <p class="panel__text">作者已关闭本文的评论功能。</p>
      </div>
    </div>

    <div v-else-if="loadError && !loading" class="page-shell__inner article-page__error">
      <p class="eyebrow">加载失败</p>
      <h1>文章加载失败</h1>
      <p class="page-shell__lead">{{ loadError }}</p>
      <div class="not-found-card__actions">
        <button class="button button--primary" type="button" @click="load">重试</button>
        <RouterLink class="button button--ghost" to="/">返回首页</RouterLink>
      </div>
    </div>

    <div v-else-if="!loading" class="page-shell__inner">
      <p class="eyebrow">Article</p>
      <h1>文章不存在</h1>
      <p class="page-shell__lead">没有找到对应文章。</p>
      <RouterLink class="button button--primary" to="/">返回首页</RouterLink>
    </div>
  </section>
</template>
