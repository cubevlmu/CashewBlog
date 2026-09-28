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
};

export const settingsSections: SettingsPageEntry<SettingsSection>[] = [
  { value: "general", label: "常规", icon: "pi pi-sliders-h" },
  { value: "profile", label: "个人资料", icon: "pi pi-user" },
  { value: "appearance", label: "外观", icon: "pi pi-palette" },
  { value: "banner", label: "横幅", icon: "pi pi-image" },
  { value: "navigation", label: "导航", icon: "pi pi-sitemap" },
  { value: "sidebar", label: "侧栏", icon: "pi pi-th-large" },
  { value: "announcement", label: "公告", icon: "pi pi-megaphone" },
  { value: "footer", label: "页脚", icon: "pi pi-window-minimize" },
  { value: "seo", label: "SEO", icon: "pi pi-search" },
  { value: "analytics", label: "统计", icon: "pi pi-chart-line" },
  { value: "article", label: "文章", icon: "pi pi-file-edit" },
];

/** Every page under `/admin/settings`, in sidebar order. */
export const settingsPages: SettingsPageEntry<SettingsPage>[] = [
  ...settingsSections,
  { value: "security", label: "安全与导出", icon: "pi pi-shield" },
];

/** Route parameter helper: unknown or missing sections fall back to `general`. */
export function settingsSection(value: unknown): SettingsSection {
  return settingsSections.some((section) => section.value === value)
    ? (value as SettingsSection)
    : "general";
}
