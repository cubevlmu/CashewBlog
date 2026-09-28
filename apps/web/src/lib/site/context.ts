import I18nKey from "@i18n/i18nKey";
import { i18n } from "@i18n/translation";
import { ApiError, getBootstrap } from "@/lib/api/client";
import type {
	CategorySummaryDto,
	SeriesSummaryDto,
	SiteBootstrapDto,
	SiteStatsDto,
	TagSummaryDto,
} from "@/lib/api/types";
import type { AnnouncementConfig } from "@/types/announcementConfig";
import type { ArticleConfig } from "@/types/articleConfig";
import type { ProfileConfig, SiteConfig } from "@/types/config";
import type { NavBarLink } from "@/types/navBarConfig";
import type { PostListConfig } from "@/types/postListConfig";
import type { SidebarConfig, SidebarWidget } from "@/types/sidebarConfig";
import type { TexturePreset } from "@/types/textureConfig";
import type { ResolvedUmamiOptions } from "@/types/umamiConfig";
import {
	DEFAULT_SETTINGS,
	type NavItemSetting,
	type PublicSiteSettings,
} from "./settings";

/**
 * Everything the public shell needs for one request, derived from
 * `/api/site/bootstrap`. Shapes deliberately match the Shirone config types
 * so presentation components stay unchanged; only the source moved from
 * `src/config/*` modules to administrator settings.
 */
export interface SiteContext {
	/** False when the API was unreachable and defaults are rendered. */
	online: boolean;
	settings: PublicSiteSettings;
	siteConfig: SiteConfig;
	profileConfig: ProfileConfig;
	navLinks: NavBarLink[];
	sidebarConfig: SidebarConfig;
	announcementConfig: AnnouncementConfig | null;
	articleConfig: ArticleConfig;
	postListConfig: PostListConfig;
	umami: ResolvedUmamiOptions;
	footerHtml: string;
	stats: SiteStatsDto;
	categories: CategorySummaryDto[];
	tags: TagSummaryDto[];
	series: SeriesSummaryDto[];
	recentPosts: SiteBootstrapDto["recentPosts"];
	pages: SiteBootstrapDto["pages"];
	version: string;
}

const TEXTURE_PRESET_MAP: Record<
	PublicSiteSettings["appearance"]["texture"]["preset"],
	TexturePreset
> = {
	none: "none",
	starlight: "starlight",
	cyberDots: "cyber-dots",
	topography: "topography",
	geometric: "geometric",
	sakura: "sakura",
};

const BANNER_ANIMATION_MAP = {
	kenBurns: "ken-burns",
	zoomIn: "zoom-in",
	zoomOut: "zoom-out",
	panLeft: "pan-left",
	panRight: "pan-right",
	none: "none",
} as const;

function toSiteConfig(s: PublicSiteSettings): SiteConfig {
	const { general, appearance, banner, article } = s;
	return {
		site: general.siteUrl,
		title: general.siteName,
		subtitle: general.subtitle,
		ogImage: s.seo.ogImage ?? undefined,
		topAppBar: { contentAlign: appearance.topAppBarAlign },
		lang: "zh_CN",
		timeZone: general.timezone,
		themeColor: {
			hue: appearance.themeHue,
			fixed: true,
			style: appearance.themeStyle,
			spec: appearance.themeSpec,
		},
		defaultMode: appearance.defaultMode,
		allowModeSwitch: appearance.allowModeSwitch,
		wallpaperMode: { defaultMode: appearance.backgroundMode },
		texture: {
			enable: appearance.texture.preset !== "none",
			defaultPreset: TEXTURE_PRESET_MAP[appearance.texture.preset],
			defaultOpacity: appearance.texture.opacity,
			allowMotion: appearance.texture.allowMotion,
		},
		banner: {
			src: { desktop: banner.desktop, mobile: banner.mobile },
			position: banner.position,
			height: banner.height,
			dim: banner.dim,
			homeText: {
				enable: banner.homeText.enable,
				title: banner.homeText.title || general.siteName,
				subtitle: banner.homeText.subtitles,
				typewriter: banner.homeText.typewriter,
			},
			carousel: {
				...banner.carousel,
				animation: BANNER_ANIMATION_MAP[banner.carousel.animation],
			},
			waves: { enable: banner.waves },
		},
		toc: article.toc,
		progressIndicator: { style: appearance.progressIndicatorStyle },
		favicon: general.favicon ? [{ src: general.favicon }] : [],
	};
}

const NAV_PRESETS: Record<
	Exclude<NavItemSetting["type"], "page" | "url">,
	{ key: I18nKey; url: string; icon: string }
> = {
	home: { key: I18nKey.home, url: "/", icon: "material-symbols:home-outline-rounded" },
	archive: { key: I18nKey.archive, url: "/archive/", icon: "material-symbols:archive-outline-rounded" },
	categories: { key: I18nKey.categories, url: "/categories/", icon: "material-symbols:folder-outline-rounded" },
	tags: { key: I18nKey.tags, url: "/tags/", icon: "material-symbols:tag-rounded" },
	series: { key: I18nKey.series, url: "/series/", icon: "material-symbols:auto-stories-outline-rounded" },
	rss: { key: I18nKey.rss, url: "/rss/", icon: "material-symbols:rss-feed-rounded" },
};

/** Normalise a custom-page slug to its public URL (`links/friends` → `/links/friends/`). */
export function customPageUrl(slug: string): string {
	const trimmed = slug.replace(/^\/+|\/+$/g, "");
	return `/${trimmed.split("/").map(encodeURIComponent).join("/")}/`;
}

function toNavLink(item: NavItemSetting, pages: SiteBootstrapDto["pages"]): NavBarLink | null {
	const children = item.children
		.map((child) => toNavLink(child, pages))
		.filter((child): child is NavBarLink => child !== null);
	if (item.type === "page") {
		const page = pages.find((p) => p.slug === item.target);
		if (!page) return null;
		return {
			name: item.label || page.title,
			url: customPageUrl(page.slug),
			icon: item.icon ?? undefined,
			external: item.openInNewTab,
			children: children.length > 0 ? children : undefined,
		};
	}
	if (item.type === "url") {
		return {
			name: item.label,
			url: item.target || undefined,
			icon: item.icon ?? undefined,
			external: item.openInNewTab,
			children: children.length > 0 ? children : undefined,
		};
	}
	const preset = NAV_PRESETS[item.type];
	return {
		name: item.label || i18n(preset.key),
		url: preset.url,
		icon: item.icon ?? preset.icon,
		pageKey: item.type,
		external: item.openInNewTab,
		children: children.length > 0 ? children : undefined,
	};
}

function toSidebarConfig(s: PublicSiteSettings): SidebarConfig {
	return {
		enable: s.sidebar.enable,
		arrangement: s.sidebar.arrangement,
		side: s.sidebar.side,
		components: s.sidebar.widgets.map(
			(w) =>
				({
					type: w.type,
					enable: w.enable,
					slot: w.slot,
					column: w.column,
					pages: w.pages,
					...(w.collapseAfter !== null ? { collapseAfter: w.collapseAfter } : {}),
				}) as SidebarWidget,
		),
	};
}

function toUmami(s: PublicSiteSettings): ResolvedUmamiOptions {
	const { umami } = s.analytics;
	const shareUrl = umami.shareUrl.trim();
	if (!umami.enable || !shareUrl) return null;
	return {
		shareUrl,
		websiteId: umami.websiteId.trim() || undefined,
		scriptUrl: umami.scriptUrl.trim() || undefined,
	};
}

const EMPTY_STATS: SiteStatsDto = {
	postCount: 0,
	totalWords: 0,
	totalViews: 0,
	siteStartDate: null,
	lastUpdatedAt: null,
};

export function createSiteContext(bootstrap: SiteBootstrapDto | null): SiteContext {
	const s = bootstrap?.settings ?? DEFAULT_SETTINGS;
	const pages = bootstrap?.pages ?? [];
	return {
		online: bootstrap !== null,
		settings: s,
		siteConfig: toSiteConfig(s),
		profileConfig: {
			avatar: s.profile.avatar ?? undefined,
			name: s.profile.name,
			bio: s.profile.bio,
			links: s.profile.links,
		},
		navLinks: s.navigation
			.map((item) => toNavLink(item, pages))
			.filter((link): link is NavBarLink => link !== null),
		sidebarConfig: toSidebarConfig(s),
		announcementConfig:
			s.announcement.enable && s.announcement.content.trim()
				? {
						title: s.announcement.title,
						content: s.announcement.content,
						closable: s.announcement.closable,
						link: s.announcement.link,
					}
				: null,
		articleConfig: {
			lastUpdated: s.article.lastUpdated,
			discovery: {
				enable: s.article.discovery.enable,
				related: {
					enable: s.article.discovery.relatedCount > 0,
					count: s.article.discovery.relatedCount,
				},
				random: {
					enable: s.article.discovery.randomCount > 0,
					count: s.article.discovery.randomCount,
				},
			},
			share: s.article.share,
		},
		postListConfig: {
			pageSize: s.article.pageSize,
			layout: {
				mode: s.appearance.postList.layout,
				cover: s.appearance.postList.cover,
				cardWidth: s.appearance.postList.cardWidth,
			},
		},
		umami: toUmami(s),
		footerHtml: s.footer.html,
		stats: bootstrap?.stats ?? EMPTY_STATS,
		categories: bootstrap?.categories ?? [],
		tags: bootstrap?.tags ?? [],
		series: bootstrap?.series ?? [],
		recentPosts: bootstrap?.recentPosts ?? [],
		pages,
		version: bootstrap?.version ?? "",
	};
}

/** Load the site context, degrading to defaults when the API is down. */
export async function loadSiteContext(): Promise<SiteContext> {
	try {
		return createSiteContext(await getBootstrap());
	} catch (error) {
		if (error instanceof ApiError && error.code === "setup_required") throw error;
		console.error("[cashewblog] bootstrap unavailable:", error);
		return createSiteContext(null);
	}
}
