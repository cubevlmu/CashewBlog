<script setup lang="ts">
import { onBeforeUnmount, onMounted, reactive } from 'vue'

import AdminMarkdownEditor from '@/components/AdminMarkdownEditor.vue'
import { useAdminPostEditor } from '@/composables/useAdminPostEditor'

const editor = reactive(useAdminPostEditor())
let previousTheme: string | undefined
let previousPreference: string | undefined

onMounted(() => {
  if (typeof document === 'undefined') {
    return
  }

  previousTheme = document.documentElement.dataset.theme
  previousPreference = document.documentElement.dataset.themePreference
  document.documentElement.dataset.theme = 'light'
  document.documentElement.dataset.themePreference = 'light'
})

onBeforeUnmount(() => {
  if (typeof document === 'undefined') {
    return
  }

  if (previousTheme) {
    document.documentElement.dataset.theme = previousTheme
  } else {
    delete document.documentElement.dataset.theme
  }

  if (previousPreference) {
    document.documentElement.dataset.themePreference = previousPreference
  } else {
    delete document.documentElement.dataset.themePreference
  }
})
</script>

<template>
  <section class="admin-section admin-editor-page">
    <header class="admin-page-heading admin-editor-page__header">
      <div>
        <h2>{{ editor.editorTitle }}</h2>
        <p class="panel__text">所见即所得编辑，保存结果仍然是 Markdown。</p>
      </div>
      <div class="admin-editor-page__actions">
        <button class="button button--ghost" type="button" :disabled="editor.saving" @click="editor.saveDraft">
          {{ editor.saving ? '保存中...' : '保存草稿' }}
        </button>
        <button class="button button--primary" type="button" :disabled="editor.saving" @click="editor.publish">
          {{ editor.saving ? '提交中...' : editor.submitButtonText }}
        </button>
      </div>
    </header>

    <div v-if="editor.loading" class="panel admin-dialog__empty">正在加载编辑器...</div>

    <div v-else class="admin-editor-page__grid">
      <section class="panel admin-editor-main">
        <label class="admin-form-field">
          <span>文章标题</span>
          <input v-model="editor.form.title" class="admin-input" type="text" placeholder="输入文章标题" />
        </label>
        <label class="admin-form-field">
          <span>文章正文</span>
        </label>

        <AdminMarkdownEditor v-model="editor.form.contentMarkdown" class="admin-markdown-editor" :disabled="editor.saving" />
      </section>

      <aside class="admin-editor-sidebar">
        <section class="panel admin-editor-sidebar__panel">
          <div class="admin-config-links__header">
            <div>
              <p class="panel__label">Publish</p>
              <h3>发布设置</h3>
            </div>
          </div>
          <div class="admin-editor-sidebar__grid">
            <label v-if="editor.canEditState" class="admin-form-field">
              <span>状态</span>
              <select v-model="editor.form.state" class="admin-select">
                <option value="draft">草稿 / 待审核</option>
                <option value="private">私密</option>
                <option value="public">公开</option>
              </select>
            </label>
            <div v-else class="admin-form-field">
              <span>状态</span>
              <div class="admin-editor-sidebar__readonly">待审核</div>
            </div>
            <label class="admin-form-field admin-editor-sidebar__field--full">
              <span>摘要</span>
              <textarea v-model="editor.form.summary" class="admin-textarea" rows="4" placeholder="输入文章摘要" />
            </label>
            <label class="admin-form-field admin-editor-sidebar__field--full">
              <span>封面图</span>
              <input v-model="editor.form.coverImage" class="admin-input" type="text" placeholder="https://..." />
            </label>
            <label class="admin-form-field">
              <span>分类</span>
              <select v-model="editor.form.categoryId" class="admin-select">
                <option :value="null">选择分类</option>
                <option v-for="category in editor.categories" :key="category.id" :value="category.id">{{ category.name }}</option>
              </select>
            </label>
            <label class="admin-form-field">
              <span>评论</span>
              <select v-model="editor.form.allowComment" class="admin-select">
                <option :value="true">允许评论</option>
                <option :value="false">关闭评论</option>
              </select>
            </label>
          </div>
        </section>

        <section class="panel admin-editor-sidebar__panel">
          <div class="admin-config-links__header">
            <div>
              <p class="panel__label">Tags</p>
              <h3>标签</h3>
            </div>
          </div>
          <div class="admin-editor-tags">
            <div class="admin-editor-tags__input">
              <select v-model="editor.selectedTagId" class="admin-select">
                <option value="">选择标签</option>
                <option v-for="tag in editor.availableTagOptions" :key="tag.id" :value="tag.id">{{ tag.name }}</option>
              </select>
              <button class="button button--ghost" type="button" @click="editor.addSelectedTag">添加</button>
            </div>
            <div class="admin-posts__tags">
              <button
                v-for="tag in editor.tags.filter((item) => editor.form.tagIds.includes(item.id))"
                :key="tag.id"
                class="admin-mini-chip admin-mini-chip--button"
                type="button"
                @click="editor.removeTag(tag.id)"
              >
                # {{ tag.name }}
              </button>
            </div>
          </div>
        </section>

        <p v-if="editor.errorMessage" class="login-form__error">{{ editor.errorMessage }}</p>
        <p v-if="editor.successMessage" class="admin-profile-editor__success">{{ editor.successMessage }}</p>
      </aside>
    </div>
  </section>
</template>
