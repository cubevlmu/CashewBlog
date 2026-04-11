import type { HomeConfig } from '@/types/site-config'
import type { ApiPublicSettings } from '@/types/api'

export function mapPublicSettingsToHomeConfig(settings: ApiPublicSettings): HomeConfig {
  return {
    navbar: {
      headText: settings.navbar?.head_text || settings.site.title,
      links: settings.navbar?.links?.length
        ? settings.navbar.links.map((link) => ({ ...link }))
        : [
            { text: '首页', link: '/' },
            { text: '分类', link: '#categories' },
            { text: '标签', link: '#tags' },
          ],
    },
    header: {
      title: settings.home.banner_title,
      subtitle: settings.home.banner_subtitle,
      animation: settings.home.typing_animation,
      image: settings.home.banner_image,
    },
    announcement: settings.site.subtitle,
    intro: {
      blogName: settings.intro?.blog_name || settings.site.title,
      hitokoto: settings.intro?.hitokoto || settings.site.subtitle,
    },
    sidebar: {
      customHtml: settings.sidebar?.custom_html || '',
    },
    owner: {
      name: settings.owner?.name || settings.site.title,
      avatar: settings.owner?.avatar || settings.site.logo,
      bio: settings.owner?.bio || settings.site.subtitle,
      links: settings.owner?.links?.map((link) => ({ ...link })) || [],
    },
    footer: {
      text: settings.footer?.text || settings.site.icp || settings.site.title,
      extraHtml: settings.footer?.extra_html || '',
    },
    summary: {
      postCount: settings.summary?.post_count ?? 0,
      categoryCount: settings.summary?.category_count ?? 0,
      tagCount: settings.summary?.tag_count ?? 0,
    },
  }
}

export function mapHomeConfigToHomePatch(config: HomeConfig) {
  return {
    banner_title: config.header.title,
    banner_subtitle: config.header.subtitle,
    banner_image: config.header.image,
    typing_animation: config.header.animation,
  }
}
