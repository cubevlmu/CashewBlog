<script setup lang="ts">
import { reactive, ref } from 'vue'

import AdminEditorJsEditor from '@/components/AdminEditorJsEditor.vue'
import AdminMediaLibraryDialog from '@/components/AdminMediaLibraryDialog.vue'
import { useAdminPostEditor } from '@/composables/useAdminPostEditor'
import type { AdminAssetRecord } from '@/types/admin'

const editor = reactive(useAdminPostEditor())
const editorComponent = ref<InstanceType<typeof AdminEditorJsEditor> | null>(null)
const mediaOpen = ref(false)
const mediaMode = ref<'content' | 'cover'>('content')

function openContentMediaLibrary() {
  mediaMode.value = 'content'
  mediaOpen.value = true
}

function openCoverMediaLibrary() {
  mediaMode.value = 'cover'
  mediaOpen.value = true
}

async function selectMedia(asset: AdminAssetRecord) {
  if (mediaMode.value === 'cover') {
    editor.form.coverImage = asset.fileUrl
    editor.form.titleImageId = asset.id
    return
  }
  await editorComponent.value?.insertMedia(asset)
}
</script>

<template>
  <section class="admin-section admin-editor-page">
    <header class="admin-page-heading admin-editor-page__header">
      <div>
        <h2>{{ editor.editorTitle }}</h2>
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

        <AdminEditorJsEditor
          ref="editorComponent"
          v-model="editor.form.contentMarkdown"
          class="admin-block-editor"
          :disabled="editor.saving"
          :open-media-library="openContentMediaLibrary"
        />
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
                <option value="draft">草稿</option>
                <option value="private">私密 / 待审核</option>
                <option value="public">公开</option>
              </select>
            </label>
            <div v-else class="admin-form-field">
              <span>状态</span>
              <div class="admin-editor-sidebar__readonly">私密 / 待审核</div>
            </div>
            <label class="admin-form-field admin-editor-sidebar__field--full">
              <span>摘要</span>
              <textarea v-model="editor.form.summary" class="admin-textarea" rows="4" placeholder="输入文章摘要" />
            </label>
            <div class="admin-form-field admin-editor-sidebar__field--full">
              <span>封面图</span>
              <button class="button button--ghost admin-editor-cover-button" type="button" :disabled="editor.saving" @click="openCoverMediaLibrary">
                {{ editor.coverButtonText }}
              </button>
              <small>{{ editor.form.coverImage ? '已选择封面图。' : '点击后打开资源库选择封面图。' }}</small>
            </div>
            <label class="admin-form-field">
              <span>分类</span>
              <select v-model="editor.form.categoryId" class="admin-select">
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

    <AdminMediaLibraryDialog
      v-model="mediaOpen"
      :title="mediaMode === 'cover' ? '选择封面图' : '插入多媒体'"
      :image-only="mediaMode === 'cover'"
      @select="selectMedia"
    />
  </section>
</template>
