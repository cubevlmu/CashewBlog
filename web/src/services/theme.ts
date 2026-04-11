import { computed, reactive } from 'vue'

export type ThemePreference = 'auto' | 'light' | 'dark'
export type ResolvedTheme = 'light' | 'dark'

const storageKey = 'cashew:theme-preference'
let mediaQuery: MediaQueryList | null = null

const state = reactive<{
  preference: ThemePreference
  systemTheme: ResolvedTheme
}>({
  preference: 'auto',
  systemTheme: 'light',
})

function getSystemTheme(): ResolvedTheme {
  if (typeof window === 'undefined') {
    return 'light'
  }

  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function readPreference(): ThemePreference {
  if (typeof window === 'undefined') {
    return 'auto'
  }

  const value = window.localStorage.getItem(storageKey)
  if (value === 'light' || value === 'dark' || value === 'auto') {
    return value
  }

  return 'auto'
}

function persistPreference(preference: ThemePreference) {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.setItem(storageKey, preference)
}

function applyTheme() {
  if (typeof document === 'undefined') {
    return
  }

  const resolved = state.preference === 'auto' ? state.systemTheme : state.preference
  document.documentElement.dataset.theme = resolved
  document.documentElement.dataset.themePreference = state.preference
}

function handleSystemThemeChange(event: MediaQueryListEvent) {
  state.systemTheme = event.matches ? 'dark' : 'light'
  applyTheme()
}

export function initTheme() {
  state.preference = readPreference()
  state.systemTheme = getSystemTheme()
  applyTheme()

  if (typeof window === 'undefined') {
    return
  }

  mediaQuery?.removeEventListener('change', handleSystemThemeChange)
  mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
  mediaQuery.addEventListener('change', handleSystemThemeChange)
}

export const themeState = reactive({
  get preference() {
    return state.preference
  },
  get resolvedTheme() {
    return (state.preference === 'auto' ? state.systemTheme : state.preference) as ResolvedTheme
  },
})

export const isDarkTheme = computed(() => themeState.resolvedTheme === 'dark')

export function setThemePreference(preference: ThemePreference) {
  state.preference = preference
  persistPreference(preference)
  applyTheme()
}
