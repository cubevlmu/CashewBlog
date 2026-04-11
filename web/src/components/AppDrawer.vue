<script setup lang="ts">
import { computed, onBeforeUnmount, watch } from 'vue'

const props = withDefaults(defineProps<{
  modelValue: boolean
  direction?: 'ltr' | 'rtl'
  size?: string
  closeOnOverlay?: boolean
  panelClass?: string
}>(), {
  direction: 'rtl',
  size: '360px',
  closeOnOverlay: true,
  panelClass: '',
})

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  close: []
}>()

const drawerClass = computed(() => (props.direction === 'ltr' ? 'is-left' : 'is-right'))
const drawerStyle = computed(() => ({ width: props.size }))
const overlayStyle = computed(() => ({
  opacity: props.modelValue ? '1' : '0',
}))

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
    <Transition name="app-drawer">
      <div v-if="modelValue" class="app-drawer" @click="handleOverlayClick">
        <div class="app-drawer__overlay" :style="overlayStyle" />
        <aside class="app-drawer__panel" :class="[drawerClass, panelClass]" :style="drawerStyle" @click.stop>
          <div class="app-drawer__body">
            <slot />
          </div>
        </aside>
      </div>
    </Transition>
  </teleport>
</template>
