<script setup lang="ts">
import { computed, onBeforeUnmount, watch } from 'vue'

const props = withDefaults(defineProps<{
  modelValue: boolean
  width?: string
  closeOnOverlay?: boolean
  panelClass?: string
  showClose?: boolean
}>(), {
  width: '560px',
  closeOnOverlay: true,
  panelClass: '',
  showClose: true,
})

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  close: []
}>()

const widthStyle = computed(() => ({ width: props.width }))

function close() {
  emit('update:modelValue', false)
  emit('close')
}

function handleOverlayClick() {
  if (props.closeOnOverlay) {
    close()
  }
}

function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && props.modelValue) {
    close()
  }
}

watch(
  () => props.modelValue,
  (open) => {
    document.body.style.overflow = open ? 'hidden' : ''
  },
  { immediate: true },
)

window.addEventListener('keydown', handleKeydown)

onBeforeUnmount(() => {
  document.body.style.overflow = ''
  window.removeEventListener('keydown', handleKeydown)
})
</script>

<template>
  <teleport to="body">
    <Transition name="app-dialog-fade" appear>
      <div v-if="modelValue" class="app-dialog" @click="handleOverlayClick">
        <div class="app-dialog__overlay" />
        <div class="app-dialog__panel" :class="panelClass" :style="widthStyle" @click.stop>
          <button v-if="showClose" class="app-dialog__close" type="button" aria-label="关闭" @click="close">
            ×
          </button>
          <div v-if="$slots.header" class="app-dialog__header">
            <slot name="header" />
          </div>
          <div class="app-dialog__body">
            <slot />
          </div>
        </div>
      </div>
    </Transition>
  </teleport>
</template>
