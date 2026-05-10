<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
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
    getCurrentBlockIndex: () => number
  }
}

const EditorJsConstructor = EditorJS as unknown as new (config: Record<string, unknown>) => EditorJsInstance

const editorI18nMessages = {
  ui: {
    blockTunes: {
      toggler: {
        'Click to tune': '点击调整',
        'or drag to move': '拖拽移动',
      },
    },
    inlineToolbar: {
      converter: {
        'Convert to': '转换为',
      },
    },
    toolbar: {
      toolbox: {
        Add: '添加',
      },
    },
    popover: {
      Filter: '筛选',
      'Nothing found': '没有找到结果',
      'Convert to': '转换为',
    },
  },
  toolNames: {
    Text: '正文',
    Heading: '标题',
    List: '列表',
    Quote: '引用',
    Code: '代码',
    Image: '图片',
    Link: '链接',
    Bold: '加粗',
    Italic: '斜体',
    InlineCode: '行内代码',
    media: '多媒体',
  },
  tools: {
    link: {
      'Add a link': '添加链接',
    },
    image: {
      'Select an Image': '选择图片',
      Caption: '图片说明',
      'With border': '显示边框',
      'Stretch image': '拉伸图片',
      'With background': '显示背景',
      'With caption': '显示说明',
      'Couldn’t upload image. Please try another.': '图片上传失败，请换一张重试。',
    },
    header: {
      'Heading 1': '一级标题',
      'Heading 2': '二级标题',
      'Heading 3': '三级标题',
      'Heading 4': '四级标题',
      'Heading 5': '五级标题',
      'Heading 6': '六级标题',
    },
    quote: {
      'Enter a quote': '输入引用内容',
      'Enter a caption': '输入引用来源',
      'Align Left': '左对齐',
      'Align Center': '居中',
    },
    code: {
      'Enter a code': '输入代码',
    },
    stub: {
      'The block can not be displayed correctly.': '这个块无法正确显示。',
    },
  },
  blockTunes: {
    delete: {
      Delete: '删除',
      'Click to delete': '点击删除',
    },
    moveUp: {
      'Move up': '上移',
    },
    moveDown: {
      'Move down': '下移',
    },
  },
}

type EditorJsToolApi = {
  blocks: {
    delete: (index?: number) => void
    getCurrentBlockIndex: () => number
  }
}

type MediaToolData = {
  mediaType?: 'audio' | 'video'
  url?: string
  title?: string
}

type MediaToolConfig = {
  openMediaLibrary?: (index: number) => void
}

class MediaTool {
  private data: Required<MediaToolData>
  private readOnly: boolean
  private api: EditorJsToolApi
  private config: MediaToolConfig

  static get toolbox() {
    return {
      title: '多媒体',
      icon: '<svg width="17" height="15" viewBox="0 0 17 15"><path d="M2 2.5h8.5a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-6a2 2 0 0 1 2-2Zm.5 2v6h7.75v-6H2.5Zm11 1.2 3-1.8v7.2l-3-1.8V5.7Z"/></svg>',
    }
  }

  static get isReadOnlySupported() {
    return true
  }

  constructor({ api, config, data, readOnly }: { api: EditorJsToolApi; config?: MediaToolConfig; data?: MediaToolData; readOnly?: boolean }) {
    this.data = {
      mediaType: data?.mediaType === 'audio' ? 'audio' : 'video',
      url: data?.url ?? '',
      title: data?.title ?? '',
    }
    this.readOnly = Boolean(readOnly)
    this.api = api
    this.config = config ?? {}
  }

  render() {
    const wrapper = document.createElement('div')
    wrapper.className = 'editorjs-media-tool'
    wrapper.dataset.mediaType = this.data.mediaType

    if (!this.data.url) {
      wrapper.classList.add('editorjs-media-tool--picker')
      window.setTimeout(() => {
        const index = this.api.blocks.getCurrentBlockIndex()
        this.config.openMediaLibrary?.(index)
        this.api.blocks.delete(index)
      })
      return wrapper
    }

    const player = document.createElement(this.data.mediaType)
    player.className = 'editorjs-media-tool__player'
    player.controls = true
    player.preload = 'metadata'
    player.src = this.data.url

    const title = document.createElement('input')
    title.className = 'editorjs-media-tool__title'
    title.type = 'text'
    title.placeholder = this.data.mediaType === 'audio' ? '音频标题' : '视频标题'
    title.value = this.data.title
    title.disabled = this.readOnly

    wrapper.append(player, title)
    return wrapper
  }

  save(block: HTMLElement): MediaToolData {
    const title = block.querySelector<HTMLInputElement>('.editorjs-media-tool__title')?.value.trim()
    return {
      mediaType: this.data.mediaType,
      url: this.data.url,
      title: title || this.data.title,
    }
  }
}

const props = withDefaults(
  defineProps<{
    modelValue: string
    height?: number | string
    placeholder?: string
    disabled?: boolean
    openMediaLibrary?: () => void
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
const contextMenu = reactive({
  open: false,
  x: 0,
  y: 0,
})
let editor: EditorJsInstance | null = null
let syncingFromEditor = false
let pendingMediaInsertIndex: number | undefined

function normalizeHeight(value: number | string) {
  return typeof value === 'number' ? value : Number.parseInt(value, 10) || 720
}

function closeContextMenu() {
  contextMenu.open = false
}

function openContextMenu(event: MouseEvent) {
  event.preventDefault()

  if (props.disabled || !editor) {
    closeContextMenu()
    return
  }

  pendingMediaInsertIndex = editor.blocks.getCurrentBlockIndex()
  contextMenu.x = event.clientX
  contextMenu.y = event.clientY
  contextMenu.open = true
}

function openMediaLibraryFromContextMenu() {
  closeContextMenu()
  props.openMediaLibrary?.()
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
  const insertIndex = pendingMediaInsertIndex
  pendingMediaInsertIndex = undefined
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
    insertIndex,
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

  const fileName = asset.fileName.toLowerCase()
  const isAudio = asset.mimeType.startsWith('audio/') || /\.(mp3|m4a|aac|flac|wav|ogg|opus)$/i.test(fileName)
  const isVideo = asset.mimeType.startsWith('video/') || /\.(mp4|mov|m4v|webm|avi|mkv)$/i.test(fileName)
  const insertIndex = pendingMediaInsertIndex

  if (isAudio || isVideo) {
    editor.blocks.insert(
      'media',
      {
        mediaType: isAudio ? 'audio' : 'video',
        url: asset.fileUrl,
        title: asset.title,
      },
      undefined,
      insertIndex,
      true,
    )
  } else {
    editor.blocks.insert('paragraph', { text: `<a href="${asset.fileUrl}">${asset.title}</a>` }, undefined, insertIndex, true)
  }
  pendingMediaInsertIndex = undefined
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
    i18n: {
      messages: editorI18nMessages,
    },
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
        toolbox: false,
        config: {
          captionPlaceholder: '图片说明',
          buttonContent: '选择图片',
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
      media: {
        class: MediaTool,
        config: {
          openMediaLibrary(index: number) {
            pendingMediaInsertIndex = index
            props.openMediaLibrary?.()
          },
        },
      },
      inlineCode: InlineCode,
    },
    async onChange() {
      await syncToModel()
    },
  })

  document.addEventListener('click', closeContextMenu)
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
  document.removeEventListener('click', closeContextMenu)
  editor?.destroy()
  editor = null
})

defineExpose({
  insertImage,
  insertMedia,
})
</script>

<template>
  <div class="admin-editorjs-shell" :style="{ minHeight: `${normalizeHeight(height)}px` }" @contextmenu="openContextMenu">
    <div ref="host" class="admin-editorjs" />
    <div
      v-if="contextMenu.open"
      class="editorjs-context-menu"
      :style="{ left: `${contextMenu.x}px`, top: `${contextMenu.y}px` }"
      @click.stop
      @contextmenu.prevent
    >
      <button type="button" class="editorjs-context-menu__item" @click="openMediaLibraryFromContextMenu">插入多媒体</button>
    </div>
  </div>
</template>
