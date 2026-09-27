/**
 * Administrator-managed site settings as delivered by `GET /api/site/bootstrap`
 * (`settings`). The backend owns validation and defaults; `DEFAULT_SETTINGS`
 * only keeps the public shell renderable when the API is unreachable.
 */

export type ThemeStyle =
	| "tonalSpot"
	| "vibrant"
	| "content"
	| "expressive"
	| "rainbow"
	| "fruitSalad"
	| "monochrome"
	| "neutral"
	| "fidelity";

export type ColorModeSetting = "light" | "dark" | "system";

export type TexturePresetSetting =
	| "none"
	| "starlight"
	| "cyberDots"
	| "topography"
	| "geometric"
	| "sakura";

export type BannerAnimationSetting =
	| "kenBurns"
	| "zoomIn"
	| "zoomOut"
	| "panLeft"
	| "panRight"
	| "none";

export type SidebarPageSetting =
	| "home"
	| "archive"
	| "categories"
	| "tags"
	| "series"
	| "post"
	| "page"
	| "search"
	| "rss"
	| "notFound";

export type SidebarWidgetType =
	| "profile"
	| "announcement"
	| "categories"
	| "tags"
	| "series"
	| "recentPosts"
	| "stats"
	| "toc";

export interface SidebarWidgetSetting {
	type: SidebarWidgetType;
	enable: boolean;
	slot: "top" | "sticky";
	column: "primary" | "secondary";
	pages: SidebarPageSetting[];
	collapseAfter: number | null;
}

export type NavItemType =
	| "home"
	| "archive"
	| "categories"
	| "tags"
	| "series"
	| "rss"
	| "page"
	| "url";

export interface NavItemSetting {
	id: string;
	label: string;
	icon: string | null;
	type: NavItemType;
	target: string;
	openInNewTab: boolean;
	children: NavItemSetting[];
}

export interface PublicSiteSettings {
	schemaVersion: number;
	general: {
		siteName: string;
		siteUrl: string;
		subtitle: string;
		description: string;
		keywords: string[];
		timezone: string;
		language: string;
		favicon: string | null;
		siteStartDate: string | null;
	};
	profile: {
		avatar: string | null;
		name: string;
		bio: string;
		email: string;
		links: { name: string; icon: string; url: string }[];
	};
	appearance: {
		themeHue: number;
		themeStyle: ThemeStyle;
		themeSpec: "2021" | "2025";
		defaultMode: ColorModeSetting;
		allowModeSwitch: boolean;
		backgroundMode: "banner" | "none";
		texture: {
			preset: TexturePresetSetting;
			opacity: number;
			allowMotion: boolean;
		};
		topAppBarAlign: "left" | "center";
		progressIndicatorStyle: "dual" | "single";
		postList: {
			layout: "list" | "grid";
			cover: "left" | "right";
			cardWidth: "compact" | "regular" | "relaxed";
		};
	};
	banner: {
		desktop: string[];
		mobile: string[];
		position: "top" | "center" | "bottom";
		height: "short" | "default" | "tall";
		dim: { enable: boolean; opacity: number };
		homeText: {
			enable: boolean;
			title: string;
			subtitles: string[];
			typewriter: {
				enable: boolean;
				speed: number;
				deleteSpeed: number;
				pauseTime: number;
				loop: boolean;
			};
		};
		carousel: {
			enable: boolean;
			interval: number;
			fadeDuration: number;
			animation: BannerAnimationSetting;
		};
		waves: boolean;
	};
	navigation: NavItemSetting[];
	sidebar: {
		enable: boolean;
		arrangement: "single" | "dual";
		side: "left" | "right";
		widgets: SidebarWidgetSetting[];
	};
	announcement: {
		enable: boolean;
		title: string;
		content: string;
		closable: boolean;
		link: { enable: boolean; text: string; url: string; external: boolean };
	};
	footer: { html: string };
	seo: {
		titleSeparator: string;
		defaultDescription: string;
		keywords: string[];
		ogImage: string | null;
		twitterHandle: string;
		extraRobots: string;
	};
	analytics: {
		umami: {
			enable: boolean;
			shareUrl: string;
			websiteId: string;
			scriptUrl: string;
		};
	};
	article: {
		pageSize: number;
		toc: { enable: boolean; depth: 1 | 2 | 3 };
		lastUpdated: { enable: boolean; minimumAgeDays: number };
		discovery: { enable: boolean; relatedCount: number; randomCount: number };
		share: { enable: boolean; includeCover: boolean };
		seriesCardPosition: "top" | "bottom";
	};
}

const widget = (
	type: SidebarWidgetType,
	slot: SidebarWidgetSetting["slot"],
	column: SidebarWidgetSetting["column"],
	pages: SidebarPageSetting[] = [],
	collapseAfter: number | null = null,
	enable = true,
): SidebarWidgetSetting => ({ type, enable, slot, column, pages, collapseAfter });

export const DEFAULT_SETTINGS: PublicSiteSettings = {
	schemaVersion: 1,
	general: {
		siteName: "CashewBlog",
		siteUrl: "http://localhost:8080/",
		subtitle: "",
		description: "",
		keywords: [],
		timezone: "Asia/Shanghai",
		language: "zh-CN",
		favicon: null,
		siteStartDate: null,
	},
	profile: { avatar: null, name: "CashewBlog", bio: "", email: "", links: [] },
	appearance: {
		themeHue: 315,
		themeStyle: "tonalSpot",
		themeSpec: "2025",
		defaultMode: "system",
		allowModeSwitch: true,
		backgroundMode: "banner",
		texture: { preset: "none", opacity: 0.12, allowMotion: true },
		topAppBarAlign: "center",
		progressIndicatorStyle: "dual",
		postList: { layout: "list", cover: "right", cardWidth: "regular" },
	},
	banner: {
		desktop: [],
		mobile: [],
		position: "center",
		height: "default",
		dim: { enable: true, opacity: 0.24 },
		homeText: {
			enable: true,
			title: "CashewBlog",
			subtitles: [],
			typewriter: {
				enable: true,
				speed: 100,
				deleteSpeed: 50,
				pauseTime: 2000,
				loop: true,
			},
		},
		carousel: {
			enable: true,
			interval: 6000,
			fadeDuration: 1200,
			animation: "kenBurns",
		},
		waves: true,
	},
	navigation: [
		{ id: "home", label: "", icon: null, type: "home", target: "", openInNewTab: false, children: [] },
		{ id: "archive", label: "", icon: null, type: "archive", target: "", openInNewTab: false, children: [] },
	],
	sidebar: {
		enable: true,
		arrangement: "dual",
		side: "left",
		widgets: [
			widget("profile", "top", "primary"),
			widget("announcement", "top", "primary", ["home"]),
			widget("categories", "sticky", "primary", [], 5),
			widget("series", "sticky", "primary", [], 5),
			widget("tags", "sticky", "primary", [], 6),
			widget("stats", "top", "secondary", ["home", "archive", "categories", "tags"]),
			widget("toc", "sticky", "secondary", ["post"]),
		],
	},
	announcement: {
		enable: false,
		title: "",
		content: "",
		closable: true,
		link: { enable: false, text: "", url: "", external: true },
	},
	footer: { html: "" },
	seo: {
		titleSeparator: " - ",
		defaultDescription: "",
		keywords: [],
		ogImage: null,
		twitterHandle: "",
		extraRobots: "",
	},
	analytics: {
		umami: { enable: false, shareUrl: "", websiteId: "", scriptUrl: "" },
	},
	article: {
		pageSize: 8,
		toc: { enable: true, depth: 2 },
		lastUpdated: { enable: true, minimumAgeDays: 90 },
		discovery: { enable: true, relatedCount: 3, randomCount: 2 },
		share: { enable: true, includeCover: true },
		seriesCardPosition: "bottom",
	},
};
