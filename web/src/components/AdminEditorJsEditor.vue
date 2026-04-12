<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import EditorJS from '@editorjs/editorjs'
import Header from '@editorjs/header'
import List from '@editorjs/list'
import Quote from '@editorjs/quote'
import Code from '@editorjs/code'
import ImageTool from '@editorjs/image'
import InlineCode from '@editorjs/inline-code'

import { uploadAdminAsset } from '@/controllers/adminController'
import { editorJsDataToMarkdown, markdownToEditorJsData, type EditorJsOutputData } from '@/utils/editorJsMarkdown'
import type { AdminAssetRecord } from '@/types/admin'

type EditorJsInstance = {
  save: () => Promise<EditorJsOutputData>
  render: (data: EditorJsOutputData) => Promise<void>
  destroy: () => void
  readOnly: {
    toggle: (readOnly?: boolean) => Promise<boolean>
  }
  blocks: {
    insert: (type: string, data?: Record<string, unknown>, config?: Record<string, unknown>, index?: number, needToFocus?: boolean) => void
  }
}

const EditorJsConstructor = EditorJS as unknown as new (config: Record<string, unknown>) => EditorJsInstance

const props = withDefaults(
  defineProps<{
    modelValue: string
    height?: number | string
    placeholder?: string
    disabled?: boolean
  }>(),
  {
    height: 720,
    placeholder: '开始编写内容...',
    disabled: false,
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const host = ref<HTMLElement | null>(null)
let editor: EditorJsInstance | null = null
let syncingFromEditor = false

function normalizeHeight(value: number | string) {
  return typeof value === 'number' ? value : Number.parseInt(value, 10) || 720
}

async function syncToModel() {
  if (!editor || syncingFromEditor) {
    return
  }

  syncingFromEditor = true
  const data = await editor.save()
  emit('update:modelValue', editorJsDataToMarkdown(data))
  queueMicrotask(() => {
    syncingFromEditor = false
  })
}

async function insertImage(asset: AdminAssetRecord) {
  if (!editor) {
    return
  }
  editor.blocks.insert(
    'image',
    {
      file: {
        url: asset.fileUrl,
      },
      caption: asset.title,
      withBorder: false,
      stretched: false,
      withBackground: false,
    },
    undefined,
    undefined,
    true,
  )
  await syncToModel()
}

async function insertMedia(asset: AdminAssetRecord) {
  if (asset.mimeType.startsWith('image/')) {
    await insertImage(asset)
    return
  }
  if (!editor) {
    return
  }

  const text = asset.mimeType.startsWith('audio/')
    ? `<a href="${asset.fileUrl}">${asset.title}</a>`
    : asset.mimeType.startsWith('video/')
      ? `<a href="${asset.fileUrl}">${asset.title}</a>`
      : `<a href="${asset.fileUrl}">${asset.title}</a>`
  editor.blocks.insert('paragraph', { text }, undefined, undefined, true)
  await syncToModel()
}

onMounted(async () => {
  await nextTick()
  if (!host.value) {
    return
  }

  editor = new EditorJsConstructor({
    holder: host.value,
    data: markdownToEditorJsData(props.modelValue),
    minHeight: normalizeHeight(props.height),
    placeholder: props.placeholder,
    readOnly: props.disabled,
    inlineToolbar: ['bold', 'italic', 'link', 'inlineCode'],
    tools: {
      header: {
        class: Header,
        inlineToolbar: true,
        config: {
          levels: [2, 3, 4],
          defaultLevel: 2,
        },
      },
      list: {
        class: List,
        inlineToolbar: true,
      },
      quote: {
        class: Quote,
        inlineToolbar: true,
      },
      code: Code,
      image: {
        class: ImageTool,
        config: {
          uploader: {
            async uploadByFile(file: File) {
              const asset = await uploadAdminAsset(file)
              return {
                success: 1,
                file: {
                  url: asset.fileUrl,
                },
              }
            },
            async uploadByUrl(url: string) {
              return {
                success: 1,
                file: { url },
              }
            },
          },
        },
      },
      inlineCode: InlineCode,
    },
    async onChange() {
      await syncToModel()
    },
  })
})

watch(
  () => props.modelValue,
  async (value) => {
    if (!editor || syncingFromEditor) {
      return
    }

    const current = editorJsDataToMarkdown(await editor.save())
    if (current === value) {
      return
    }

    await editor.render(markdownToEditorJsData(value))
  },
)

watch(
  () => props.disabled,
  async (disabled) => {
    await editor?.readOnly.toggle(disabled)
  },
)

onBeforeUnmount(() => {
  editor?.destroy()
  editor = null
})

defineExpose({
  insertImage,
  insertMedia,
})
</script>

<template>
  <div class="admin-editorjs-shell" :style="{ minHeight: `${normalizeHeight(height)}px` }">
    <div ref="host" class="admin-editorjs" />
  </div>
</template>
