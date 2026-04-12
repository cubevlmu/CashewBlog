<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
import { faFileAudio, faFileImage, faFileLines, faFileVideo } from '@fortawesome/free-solid-svg-icons'

import AppDialog from '@/components/AppDialog.vue'
import { getAdminAssets, getAdminUploadLimitBytes, uploadAdminAsset } from '@/controllers/adminController'
import { authState } from '@/stores/authStore'
import type { AdminAssetRecord } from '@/types/admin'

const props = withDefaults(
  defineProps<{
    modelValue: boolean
    title?: string
    imageOnly?: boolean
  }>(),
  {
    title: '选择媒体',
    imageOnly: true,
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  select: [asset: AdminAssetRecord]
}>()

const assets = ref<AdminAssetRecord[]>([])
const loading = ref(false)
const errorMessage = ref('')
const keyword = ref('')
const scopeFilter = ref<'all' | 'mine'>('all')
const typeFilter = ref<'all' | 'image' | 'audio' | 'video' | 'file'>('all')
const dateFilter = ref('all')
const selectedId = ref<number | null>(null)
const uploadFile = ref<File | null>(null)
const uploadError = ref('')
const uploading = ref(false)
const uploadMaxBytes = ref(10 * 1024 * 1024)

const isAdmin = computed(() => authState.user?.role === 'admin')
const selectedAsset = computed(() => assets.value.find((asset) => asset.id === selectedId.value) ?? null)

const dateOptions = computed(() => {
  const labels = new Set<string>()
  assets.value.forEach((asset) => {
    const date = new Date(asset.uploadedAt)
    if (!Number.isNaN(date.getTime())) {
      labels.add(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`)
    }
  })
  return Array.from(labels).sort((left, right) => right.localeCompare(left))
})

const filteredAssets = computed(() => {
  const normalized = keyword.value.trim().toLowerCase()
  return assets.value.filter((asset) => {
    if (props.imageOnly && !asset.mimeType.startsWith('image/')) return false
    if (!props.imageOnly && typeFilter.value !== 'all' && assetKind(asset) !== typeFilter.value) return false
    if (dateFilter.value !== 'all') {
      const date = new Date(asset.uploadedAt)
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
      if (key !== dateFilter.value) return false
    }
    if (!normalized) return true
    return [asset.title, asset.fileName, asset.mimeType].join(' ').toLowerCase().includes(normalized)
  })
})

function assetKind(asset: Pick<AdminAssetRecord, 'mimeType' | 'fileName'>) {
  const mimeType = asset.mimeType.toLowerCase()
  const fileName = asset.fileName.toLowerCase()
  if (mimeType.startsWith('image/')) return 'image'
  if (mimeType.startsWith('audio/') || /\.(mp3|m4a|aac|flac|wav|ogg|opus)$/i.test(fileName)) return 'audio'
  if (mimeType.startsWith('video/') || /\.(mp4|mov|m4v|webm|avi|mkv)$/i.test(fileName)) return 'video'
  return 'file'
}

function assetKindLabel(asset: Pick<AdminAssetRecord, 'mimeType' | 'fileName'>) {
  const kind = assetKind(asset)
  if (kind === 'image') return '图片'
  if (kind === 'audio') return '音频'
  if (kind === 'video') return '视频'
  return '文件'
}

function assetIcon(asset: Pick<AdminAssetRecord, 'mimeType' | 'fileName'>) {
  const kind = assetKind(asset)
  if (kind === 'image') return faFileImage
  if (kind === 'audio') return faFileAudio
  if (kind === 'video') return faFileVideo
  return faFileLines
}

function formatFileSize(bytes: number) {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`
  }
  if (bytes >= 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`
  }
  return `${bytes} B`
}

async function load() {
  loading.value = true
  errorMessage.value = ''
  try {
    if (!isAdmin.value) {
      scopeFilter.value = 'mine'
    }
    assets.value = await getAdminAssets({
      page: 1,
      pageSize: 100,
      type: props.imageOnly ? 'image' : 'all',
      scope: isAdmin.value ? scopeFilter.value : 'mine',
      state: 'normal',
    })
    if (!assets.value.some((asset) => asset.id === selectedId.value)) {
      selectedId.value = null
    }
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : '媒体资源加载失败'
  } finally {
    loading.value = false
  }
}

async function loadLimit() {
  try {
    uploadMaxBytes.value = await getAdminUploadLimitBytes()
  } catch {
    uploadMaxBytes.value = 10 * 1024 * 1024
  }
}

function chooseFile(event: Event) {
  const input = event.target as HTMLInputElement
  uploadFile.value = input.files?.[0] ?? null
  uploadError.value = ''
}

async function submitUpload() {
  uploadError.value = ''
  const file = uploadFile.value
  if (!file) {
    uploadError.value = '请选择要上传的文件'
    return
  }
  if (file.size > uploadMaxBytes.value) {
    uploadError.value = `文件大小不能超过 ${formatFileSize(uploadMaxBytes.value)}`
    return
  }

  uploading.value = true
  try {
    const asset = await uploadAdminAsset(file)
    uploadFile.value = null
    assets.value = [asset, ...assets.value.filter((item) => item.id !== asset.id)]
    selectedId.value = asset.id
  } catch (error) {
    uploadError.value = error instanceof Error ? error.message : '上传失败'
  } finally {
    uploading.value = false
  }
}

function confirmSelection() {
  if (!selectedAsset.value) return
  emit('select', selectedAsset.value)
  emit('update:modelValue', false)
}

watch(
  () => props.modelValue,
  (open) => {
    if (open) {
      void Promise.all([load(), loadLimit()])
    }
  },
)

watch(scopeFilter, () => {
  if (props.modelValue) {
    void load()
  }
})
</script>

<template>
  <AppDialog :model-value="modelValue" width="1120px" panel-class="admin-dialog admin-media-dialog" :show-close="false" @update:model-value="$emit('update:modelValue', $event)">
    <template #header>
      <div class="admin-dialog__header media-library-header">
        <div>
          <p class="panel__label">Media</p>
          <h3>{{ title }}</h3>
        </div>
        <div class="media-library-header__actions">
          <button class="button button--primary" type="button" :disabled="!selectedAsset" @click="confirmSelection">使用所选媒体</button>
          <button class="button button--ghost" type="button" @click="$emit('update:modelValue', false)">关闭</button>
        </div>
      </div>
    </template>

    <div class="media-frame-content" role="tabpanel" aria-labelledby="menu-item-browse" tabindex="0" data-columns="7">
      <div class="media-library-panel">
        <div class="media-library-toolbar">
          <h2>{{ imageOnly ? '图片资源库' : '媒体资源库' }}</h2>
          <select v-if="isAdmin" v-model="scopeFilter" class="admin-select">
            <option value="all">{{ imageOnly ? '全部图片' : '全部媒体' }}</option>
            <option value="mine">我的</option>
          </select>
          <select v-if="!imageOnly" v-model="typeFilter" class="admin-select">
            <option value="all">全部类型</option>
            <option value="image">图片</option>
            <option value="audio">音频</option>
            <option value="video">视频</option>
            <option value="file">文件</option>
          </select>
          <select v-model="dateFilter" class="admin-select">
            <option value="all">全部日期</option>
            <option v-for="date in dateOptions" :key="date" :value="date">{{ date }}</option>
          </select>
          <input v-model="keyword" class="admin-input media-library-search" type="search" placeholder="搜索媒体" />
          <span v-if="loading" class="spinner"></span>
        </div>

        <div class="media-library-body">
          <div class="media-library-grid-wrap">
            <div v-if="loading" class="admin-dialog__empty">正在加载媒体...</div>
            <div v-else-if="filteredAssets.length === 0" class="media-library-empty">
              <h2>{{ errorMessage || '找不到条目。' }}</h2>
              <p>可以直接上传一个新文件。</p>
            </div>
            <div v-else class="media-library-grid">
              <button
                v-for="asset in filteredAssets"
                :key="asset.id"
                class="media-library-card"
                :class="{ 'is-selected': selectedId === asset.id }"
                type="button"
                :aria-pressed="selectedId === asset.id"
                @click="selectedId = asset.id"
              >
                <span v-if="assetKind(asset) === 'image'" class="media-library-card__thumb">
                  <img :src="asset.thumbnailUrl" draggable="false" :alt="asset.title" />
                </span>
                <span v-else class="media-library-card__thumb media-library-card__thumb--icon" :data-kind="assetKind(asset)">
                  <FontAwesomeIcon :icon="assetIcon(asset)" />
                  <span>{{ assetKindLabel(asset) }}</span>
                </span>
                <span class="media-library-card__body">
                  <strong>{{ asset.title }}</strong>
                  <small>{{ assetKindLabel(asset) }} / {{ asset.fileSizeLabel }}</small>
                </span>
              </button>
            </div>
            <p class="load-more-count">显示 {{ filteredAssets.length }} 个媒体项目</p>
          </div>

          <aside class="media-library-side">
            <div class="media-uploader-status">
              <h2>上传</h2>
              <label class="media-library-upload-picker">
                <span>{{ uploadFile ? uploadFile.name : '选择文件' }}</span>
                <input type="file" :accept="imageOnly ? 'image/*' : undefined" :disabled="uploading" @change="chooseFile" />
              </label>
              <p class="max-upload-size">最大上传文件大小：{{ formatFileSize(uploadMaxBytes) }}。</p>
              <p v-if="uploadFile" class="max-upload-size">{{ uploadFile.name }} / {{ formatFileSize(uploadFile.size) }}</p>
              <p v-if="uploadError" class="login-form__error">{{ uploadError }}</p>
              <button type="button" class="button button--ghost" :disabled="uploading" @click="submitUpload">{{ uploading ? '上传中...' : '上传到资源库' }}</button>
            </div>

            <div v-if="selectedAsset" class="media-selection-detail">
              <h2>附件详情</h2>
              <img v-if="assetKind(selectedAsset) === 'image'" :src="selectedAsset.thumbnailUrl" :alt="selectedAsset.title" />
              <div v-else class="media-selection-detail__icon" :data-kind="assetKind(selectedAsset)">
                <FontAwesomeIcon :icon="assetIcon(selectedAsset)" />
                <span>{{ assetKindLabel(selectedAsset) }}</span>
              </div>
              <strong>{{ selectedAsset.title }}</strong>
              <span>{{ selectedAsset.fileName }}</span>
              <span>{{ selectedAsset.fileSizeLabel }}</span>
            </div>
          </aside>
        </div>
      </div>
    </div>
  </AppDialog>
</template>
