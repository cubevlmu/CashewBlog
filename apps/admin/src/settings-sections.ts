import type { SiteSettings } from "./api/types";

/** Settings section keys, each addressable at `/admin/settings/<value>`. */
export type SettingsSection = Exclude<keyof SiteSettings, "schemaVersion">;

/** Extra settings pages that are not backed by a `SiteSettings` section. */
export type SettingsExtraSection = "security";

export type SettingsPage = SettingsSection | SettingsExtraSection;

type SettingsPageEntry<T extends string> = {
  value: T;
  label: string;
  icon: string;
  description: string;
};

export const settingsSections: SettingsPageEntry<SettingsSection>[] = [
  { value: "general", label: "常规", icon: "pi pi-sliders-h", description: "站点名称、网址、关键词与时区等基础信息。" },
  { value: "profile", label: "个人资料", icon: "pi pi-user", description: "侧栏个人资料卡片中的头像、简介与社交链接。" },
  { value: "appearance", label: "外观", icon: "pi pi-palette", description: "主题色、明暗模式、背景纹理与文章列表样式。" },
  { value: "banner", label: "横幅", icon: "pi pi-image", description: "首页横幅图片、标题文字与轮播效果。" },
  { value: "navigation", label: "导航", icon: "pi pi-sitemap", description: "顶栏导航菜单的链接与层级。" },
  { value: "sidebar", label: "侧栏", icon: "pi pi-th-large", description: "侧栏布局以及各组件的位置与显示页面。" },
  { value: "announcement", label: "公告", icon: "pi pi-megaphone", description: "显示在侧栏的站点公告。" },
  { value: "footer", label: "页脚", icon: "pi pi-window-minimize", description: "插入所有公开页面底部的自定义 HTML。" },
  { value: "seo", label: "SEO", icon: "pi pi-search", description: "搜索引擎与社交分享使用的标题、描述和图片。" },
  { value: "analytics", label: "统计", icon: "pi pi-chart-line", description: "接入 Umami 访问统计。" },
  { value: "article", label: "文章", icon: "pi pi-file-edit", description: "文章列表、目录、推荐与分享的行为。" },
];

/** Every page under `/admin/settings`, in sidebar order. */
export const settingsPages: SettingsPageEntry<SettingsPage>[] = [
  ...settingsSections,
  { value: "security", label: "安全与导出", icon: "pi pi-shield", description: "修改管理员密码，导出设置与文章。" },
];

/** Route parameter helper: unknown or missing sections fall back to `general`. */
export function settingsSection(value: unknown): SettingsSection {
  return settingsSections.some((section) => section.value === value)
    ? (value as SettingsSection)
    : "general";
}
