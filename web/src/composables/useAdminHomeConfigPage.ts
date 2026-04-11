import { reactive, ref } from 'vue'

import { patchAdminHomeConfig } from '@/controllers/adminController'
import { loadPublicSiteConfig } from '@/controllers/publicController'
import type { AdminHomeConfigSettings } from '@/types/admin'
import type { HomeConfig } from '@/types/site'

function createEmptySettings(): AdminHomeConfigSettings {
  return {
    navbarHeadText: '',
    navbarLinks: [],
    heroTitle: '',
    heroSubtitle: '',
    heroImage: '',
    heroAnimation: true,
    announcement: '',
    sidebarCustomHtml: '',
    ownerName: '',
    ownerAvatar: '',
    ownerBio: '',
    ownerLinks: [],
    footerText: '',
    footerExtraHtml: '',
  }
}

export function useAdminHomeConfigPage() {
  const form = reactive<AdminHomeConfigSettings>(createEmptySettings())
  const loading = ref(false)
  const saving = ref(false)
  const errorMessage = ref('')
  const successMessage = ref('')
  const currentConfig = ref<HomeConfig | null>(null)

  function syncFromConfig(config: HomeConfig) {
    form.navbarHeadText = config.navbar.headText
    form.navbarLinks = config.navbar.links.map((link) => ({ ...link }))
    form.heroTitle = config.header.title
    form.heroSubtitle = config.header.subtitle
    form.heroImage = config.header.image
    form.heroAnimation = config.header.animation
    form.announcement = config.announcement
    form.sidebarCustomHtml = config.sidebar.customHtml
    form.ownerName = config.owner.name
    form.ownerAvatar = config.owner.avatar
    form.ownerBio = config.owner.bio
    form.ownerLinks = config.owner.links.map((link) => ({ ...link }))
    form.footerText = config.footer.text
    form.footerExtraHtml = config.footer.extraHtml
  }

  async function load() {
    loading.value = true
    errorMessage.value = ''

    try {
      const config = await loadPublicSiteConfig()
      currentConfig.value = config
      syncFromConfig(config)
    } catch (error) {
      errorMessage.value = error instanceof Error ? error.message : '首页配置加载失败'
    } finally {
      loading.value = false
    }
  }

  function addNavbarLink() {
    form.navbarLinks.push({ text: '', link: '' })
  }

  function removeNavbarLink(index: number) {
    form.navbarLinks.splice(index, 1)
  }

  function addOwnerLink() {
    form.ownerLinks.push({ text: '', link: '', icon: '' })
  }

  function removeOwnerLink(index: number) {
    form.ownerLinks.splice(index, 1)
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
          headText: form.navbarHeadText.trim(),
          links: form.navbarLinks
            .map((link) => ({ text: link.text.trim(), link: link.link.trim() }))
            .filter((link) => link.text && link.link),
        },
        header: {
          title: form.heroTitle.trim(),
          subtitle: form.heroSubtitle.trim(),
          animation: form.heroAnimation,
          image: form.heroImage.trim(),
        },
        announcement: form.announcement.trim(),
        sidebar: {
          customHtml: form.sidebarCustomHtml,
        },
        owner: {
          name: form.ownerName.trim(),
          avatar: form.ownerAvatar.trim(),
          bio: form.ownerBio.trim(),
          links: form.ownerLinks
            .map((link) => ({ text: link.text.trim(), link: link.link.trim(), icon: link.icon?.trim() || '' }))
            .filter((link) => link.text && link.link),
        },
        footer: {
          text: form.footerText.trim(),
          extraHtml: form.footerExtraHtml,
        },
      }

      await patchAdminHomeConfig(nextConfig)
      currentConfig.value = nextConfig
      syncFromConfig(currentConfig.value)
      successMessage.value = '首页配置已保存'
    } catch (error) {
      errorMessage.value = error instanceof Error ? error.message : '首页配置保存失败'
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
    addNavbarLink,
    removeNavbarLink,
    addOwnerLink,
    removeOwnerLink,
    submit,
  }
}
