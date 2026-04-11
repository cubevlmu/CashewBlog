import { reactive, ref } from 'vue'

import { patchAdminHomeConfig } from '@/controllers/adminController'
import { loadPublicSiteConfig } from '@/controllers/publicController'
import type { AdminSiteSettings } from '@/types/admin'
import type { HomeConfig } from '@/types/site'

const smtpStorageKey = 'cashew:admin-smtp-settings'

function createEmptySettings(): AdminSiteSettings {
  return {
    siteTitle: '',
    introBlogName: '',
    introHitokoto: '',
    announcement: '',
    smtpHost: '',
    smtpPort: '587',
    smtpUsername: '',
    smtpPassword: '',
    smtpFromName: '',
    smtpFromEmail: '',
    smtpEncryption: 'tls',
  }
}

function readStoredSmtpSettings() {
  if (typeof window === 'undefined') {
    return null
  }

  const raw = window.localStorage.getItem(smtpStorageKey)
  if (!raw) {
    return null
  }

  try {
    return JSON.parse(raw) as Pick<
      AdminSiteSettings,
      'smtpHost' | 'smtpPort' | 'smtpUsername' | 'smtpPassword' | 'smtpFromName' | 'smtpFromEmail' | 'smtpEncryption'
    >
  } catch {
    window.localStorage.removeItem(smtpStorageKey)
    return null
  }
}

function persistSmtpSettings(form: AdminSiteSettings) {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.setItem(smtpStorageKey, JSON.stringify({
    smtpHost: form.smtpHost,
    smtpPort: form.smtpPort,
    smtpUsername: form.smtpUsername,
    smtpPassword: form.smtpPassword,
    smtpFromName: form.smtpFromName,
    smtpFromEmail: form.smtpFromEmail,
    smtpEncryption: form.smtpEncryption,
  }))
}

export function useAdminSettingsPage() {
  const form = reactive<AdminSiteSettings>(createEmptySettings())
  const loading = ref(false)
  const saving = ref(false)
  const errorMessage = ref('')
  const successMessage = ref('')
  const currentConfig = ref<HomeConfig | null>(null)

  function syncFromConfig(config: HomeConfig) {
    form.siteTitle = config.navbar.headText
    form.introBlogName = config.intro.blogName
    form.introHitokoto = config.intro.hitokoto
    form.announcement = config.announcement

    const smtp = readStoredSmtpSettings()
    form.smtpHost = smtp?.smtpHost ?? ''
    form.smtpPort = smtp?.smtpPort ?? '587'
    form.smtpUsername = smtp?.smtpUsername ?? ''
    form.smtpPassword = smtp?.smtpPassword ?? ''
    form.smtpFromName = smtp?.smtpFromName ?? ''
    form.smtpFromEmail = smtp?.smtpFromEmail ?? ''
    form.smtpEncryption = smtp?.smtpEncryption ?? 'tls'
  }

  async function load() {
    loading.value = true
    errorMessage.value = ''

    try {
      const config = await loadPublicSiteConfig()
      currentConfig.value = config
      syncFromConfig(config)
    } catch (error) {
      errorMessage.value = error instanceof Error ? error.message : '站点设置加载失败'
    } finally {
      loading.value = false
    }
  }

  async function submit() {
    if (!currentConfig.value) {
      return
    }

    errorMessage.value = ''
    successMessage.value = ''
    saving.value = true

    try {
      const nextConfig: HomeConfig = {
        ...currentConfig.value,
        navbar: {
          ...currentConfig.value.navbar,
          headText: form.siteTitle.trim(),
        },
        intro: {
          blogName: form.introBlogName.trim(),
          hitokoto: form.introHitokoto.trim(),
        },
        announcement: form.announcement.trim(),
      }

      await patchAdminHomeConfig(nextConfig)
      currentConfig.value = nextConfig
      persistSmtpSettings(form)
      syncFromConfig(currentConfig.value)
      successMessage.value = '站点设置已保存'
    } catch (error) {
      errorMessage.value = error instanceof Error ? error.message : '站点设置保存失败'
    } finally {
      saving.value = false
    }
  }

  void load()

  return {
    form,
    loading,
    saving,
    errorMessage,
    successMessage,
    load,
    submit,
  }
}
