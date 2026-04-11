<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'

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
type VditorInstance = {
  disabled: () => void
  enable: () => void
  getValue: () => string
  setValue: (value: string) => void
  destroy: () => void
}

type VditorConstructor = new (element: HTMLElement, options: Record<string, unknown>) => VditorInstance

let editor: VditorInstance | null = null
let syncingFromEditor = false

function normalizeHeight(value: number | string) {
  return typeof value === 'number' ? value : Number.parseInt(value, 10) || 720
}

function syncDisabledState() {
  if (!editor) {
    return
  }

  if (props.disabled) {
    editor.disabled()
  } else {
    editor.enable()
  }
}

onMounted(async () => {
  await nextTick()
  if (!host.value) {
    return
  }

  const [{ default: Vditor }] = await Promise.all([
    import('vditor') as Promise<{ default: VditorConstructor }>,
    import('vditor/dist/index.css'),
  ])

  editor = new Vditor(host.value, {
    mode: 'wysiwyg',
    lang: 'zh_CN',
    theme: 'classic',
    icon: 'material',
    height: normalizeHeight(props.height),
    minHeight: 520,
    placeholder: props.placeholder,
    value: props.modelValue,
    cache: {
      enable: false,
    },
    counter: {
      enable: true,
      type: 'markdown',
    },
    toolbarConfig: {
      pin: true,
    },
    preview: {
      mode: 'editor',
      markdown: {
        toc: true,
      },
    },
    toolbar: [
      'headings',
      'bold',
      'italic',
      'strike',
      '|',
      'quote',
      'list',
      'ordered-list',
      'check',
      '|',
      'link',
      'image',
      'table',
      'code',
      'inline-code',
      '|',
      'undo',
      'redo',
    ],
    input(value: string) {
      syncingFromEditor = true
      emit('update:modelValue', value)
      queueMicrotask(() => {
        syncingFromEditor = false
      })
    },
    after() {
      syncDisabledState()
    },
  })
})

watch(
  () => props.modelValue,
  (value) => {
    if (!editor || syncingFromEditor || editor.getValue() === value) {
      return
    }

    editor.setValue(value)
  },
)

watch(
  () => props.disabled,
  () => {
    syncDisabledState()
  },
)

onBeforeUnmount(() => {
  editor?.destroy()
  editor = null
})
</script>

<template>
  <div ref="host" class="admin-vditor" />
</template>
