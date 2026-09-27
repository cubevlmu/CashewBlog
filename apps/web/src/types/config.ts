import type { AUTO_MODE, DARK_MODE, LIGHT_MODE } from "@constants/constants";
import type { TextureConfig } from "./textureConfig";

export type WallpaperMode = "banner" | "none";

export type TopAppBarContentAlign = "left" | "center";

export type BannerConfig = {
	/** 媒体库图片 URL，数组顺序即轮播顺序 */
	src: {
		desktop: string[];
		mobile: string[];
	};
	position?: "top" | "center" | "bottom";
	/** 横幅高度档位 */
	height: "short" | "default" | "tall";
	dim: {
		enable: boolean;
		opacity: number;
	};
	homeText: {
		enable: boolean;
		title: string;
		/** 首页副标题文本，支持单条字符串或多条交替循环的字符串数组 */
		subtitle: string | string[];
		typewriter: {
			enable: boolean;
			/** 打字速度（每个字符间隔，毫秒，默认 120） */
			speed: number;
			/** 回退反向删除速度（每个字符间隔，毫秒，默认 50） */
			deleteSpeed?: number;
			/** 打字完成后等待停顿时间（毫秒，默认 2000） */
			pauseTime?: number;
			/** 完成后是否循环播放（默认 true） */
			loop: boolean;
		};
	};
	carousel: {
		enable: boolean;
		interval: number;
		/** 交叉淡入淡出过渡时长（毫秒，默认 1200） */
		fadeDuration?: number;
		/** 运镜呼吸动画模式："ken-burns"（默认，序列运镜）| "zoom-in" | "zoom-out" | "pan-left" | "pan-right" | "none" */
		animation?:
			| "ken-burns"
			| "zoom-in"
			| "zoom-out"
			| "pan-left"
			| "pan-right"
			| "none";
	};
	waves: {
		enable: boolean;
	};
};

export type SiteConfig = {
	site: string;
	base?: string;
	title: string;
	subtitle: string;
	/** 默认社交媒体分享预览图（og:image / twitter:image），支持本地相对路径或远程绝对链接。未配置时自动回退为第一张桌面版横幅壁纸。 */
	ogImage?: string;
	topAppBar: {
		/** 桌面端标题与导航内容组的对齐方式。 */
		contentAlign: TopAppBarContentAlign;
	};


	lang: "zh_CN";

	/** IANA time zone used to interpret precise content timestamps. */
	timeZone: string;

	themeColor: {
		hue: number;
		fixed: boolean;
		style: string;
		spec: string;
	};
	/** 默认明暗模式；访客仅在 allowModeSwitch 时可切换（选择存 localStorage） */
	defaultMode: "light" | "dark" | "system";
	allowModeSwitch: boolean;
	wallpaperMode: {
		defaultMode: WallpaperMode;
	};
	/** 页面背景纹理（管理员设置；访客不可切换） */
	texture: TextureConfig;
	banner: BannerConfig;
	/** Markdown 正文图片处理配置。 */
	imageOptimization?: {
		/** 添加 `referrerpolicy="no-referrer"` 的远程图片域名，支持 `*.example.com` 通配符。 */
		noReferrerDomains?: string[];
	};
	toc: {
		enable: boolean;
		depth: 1 | 2 | 3;
	};

	/** 进度条预设样式（页面切换进度条等，仅线性扫描模式） */
	progressIndicator: {
		/** dual 双向扫描（官方默认双线）/ single 单向扫描（单线） */
		style: "dual" | "single";
	};

	favicon: Favicon[];
};

export type Favicon = {
	src: string;
	theme?: "light" | "dark";
	sizes?: string;
};

export type ProfileConfig = {
	avatar?: string;
	name: string;
	bio?: string;
	links: {
		name: string;
		url: string;
		icon: string;
	}[];
};


export type LIGHT_DARK_MODE =
	| typeof LIGHT_MODE
	| typeof DARK_MODE
	| typeof AUTO_MODE;

export type ExpressiveCodeConfig = {
	theme: string;
	lightTheme?: string;
	darkTheme?: string;
};
