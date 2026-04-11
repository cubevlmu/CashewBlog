<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
import { faCircleHalfStroke, faMoon, faPenNib, faSun } from '@fortawesome/free-solid-svg-icons'

import { setThemePreference, themeState } from '@/services/theme'
import type { ThemePreference } from '@/services/theme'

const open = ref(false)
const route = useRoute()
const router = useRouter()

const options: Array<{ value: ThemePreference; label: string; icon: typeof faSun }> = [
  { value: 'auto', label: '自动', icon: faCircleHalfStroke },
  { value: 'light', label: '浅色', icon: faSun },
  { value: 'dark', label: '深色', icon: faMoon },
]

function toggleOpen() {
  open.value = !open.value
}

function selectTheme(value: ThemePreference) {
  setThemePreference(value)
  open.value = false
}

const showPublishButton = computed(() => String(route.name).startsWith('admin-'))

function openPublishPage() {
  void router.push({ name: 'admin-post-editor' })
}
</script>

<template>
  <div class="theme-fab" :class="{ 'is-open': open }">
    <button
      v-if="showPublishButton"
      class="theme-fab__publish"
      type="button"
      title="发布文章"
      @click="openPublishPage"
    >
      <FontAwesomeIcon :icon="faPenNib" />
    </button>

    <Transition name="theme-fab-menu">
      <div v-if="open" class="theme-fab__menu">
        <button
          v-for="option in options"
          :key="option.value"
          class="theme-fab__option"
          :class="{ 'is-active': themeState.preference === option.value }"
          type="button"
          :title="option.label"
          @click="selectTheme(option.value)"
        >
          <FontAwesomeIcon :icon="option.icon" />
        </button>
      </div>
    </Transition>

    <button class="theme-fab__button" type="button" :title="'主题模式：' + options.find((item) => item.value === themeState.preference)?.label" @click="toggleOpen">
      <FontAwesomeIcon :icon="faCircleHalfStroke" />
    </button>
  </div>
</template>
