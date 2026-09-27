import I18nKey from "@i18n/i18nKey";
import { i18n } from "@i18n/translation";
import type { NavBarConfig, NavBarLink } from "@/types/navBarConfig";

/** Transitional static nav. CashewBlog backend will replace this with bootstrap data. */
export const LinkPresets: Record<string, NavBarLink> = {
	Home: { name: i18n(I18nKey.home), url: "/", icon: "material-symbols:home-outline-rounded", pageKey: "home" },
	Archive: { name: i18n(I18nKey.archive), url: "/archive/", icon: "material-symbols:archive-outline-rounded", pageKey: "archive" },
	Categories: { name: i18n(I18nKey.categories), url: "/categories/", icon: "material-symbols:folder-outline-rounded", pageKey: "categories" },
	Tags: { name: i18n(I18nKey.tags), url: "/tags/", icon: "material-symbols:tag-rounded", pageKey: "tags" },
	Series: { name: i18n(I18nKey.series), url: "/series/", icon: "material-symbols:auto-stories-outline-rounded", pageKey: "series" },
	About: { name: i18n(I18nKey.about), url: "/about/", icon: "material-symbols:info-outline-rounded", pageKey: "about" },
};

export const navBarConfig: NavBarConfig = {
	links: [
		LinkPresets.Home,
		LinkPresets.Archive,
		{ name: i18n(I18nKey.more), icon: "material-symbols:apps-rounded", children: [LinkPresets.Categories, LinkPresets.Tags, LinkPresets.Series, LinkPresets.About] },
	],
};
