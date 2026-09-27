/**
 * FAB 导航系统类型定义
 * 值与默认配置见 src/config/fabConfig.ts。
 */
import type { SidebarPage } from "./sidebarConfig";

/**
 * 目标设备类型枚举：
 * - mobile: 移动端视口（< 768px，对应 Tailwind max-md）
 * - tablet: 平板视口（768px ~ 1023px，对应 Tailwind md 至 max-lg）
 * - desktop: 桌面电脑视口（>= 1024px，对应 Tailwind lg 及以上）
 */
export type FabDeviceTarget = "mobile" | "tablet" | "desktop";

/**
 * 单个 FAB 基础配置接口
 */
export interface BaseFabItemConfig {
	/** 是否启用该 FAB 组件 */
	enable: boolean;
	/**
	 * 允许渲染并显示的设备清单。
	 * 省略或传入空数组时默认在所有设备（["mobile", "tablet", "desktop"]）上生效。
	 */
	devices?: FabDeviceTarget[];
	/**
	 * 限定生效的页面标识符（对齐 SidebarPage）。
	 * 省略或为空数组表示在所有页面允许显示。
	 */
	pages?: SidebarPage[];
}

/** 1. 返回顶部（BackToTop）：滚动越过指定阈值时平滑浮现 */
export interface FabTopConfig extends BaseFabItemConfig {
	type: "top";
	/** 滚动触发阈值（占首屏 Banner 高度的百分比，默认跟随 BANNER_HEIGHT） */
	scrollThresholdRatio?: number;
}

/** 2. 悬浮目录（FloatingTOC）：提供移动端/无侧边栏页面弹窗式导航 */
export interface FabTocConfig extends BaseFabItemConfig {
	type: "toc";
	/** 目录抓取深度（默认 3 级） */
	depth?: 1 | 2 | 3;
	/** 点击标题链接后是否自动收起面板（默认 true） */
	closeOnSelect?: boolean;
}

/** 3. 直达评论（BackToComment）：快速平滑滚动至评论区 */
export interface FabCommentConfig extends BaseFabItemConfig {
	type: "comment";
	/** 评论容器选择器（默认 "#comment-container"） */
	targetSelector?: string;
}

/** 4. 返回首页（BackToHome）：非首页路由快速返回根目录 */
export interface FabHomeConfig extends BaseFabItemConfig {
	type: "home";
	/** 是否仅在非首页路由（!isHomePage）时显示（默认 true） */
	onlySubPages?: boolean;
}

/** 判别联合类型：FAB 项配置集 */
export type FabItemConfig =
	| FabTopConfig
	| FabTocConfig
	| FabCommentConfig
	| FabHomeConfig;

/**
 * FAB 导航系统全局总配置
 */
export interface FabConfig {
	/** 全局主开关。为 false 时零 DOM、零 JS 脚本输出 */
	enable: boolean;
	/** 停靠位置（默认右下角 end） */
	align?: "end" | "start";
	/** 距离视口边距（rem，支持设备自适应） */
	offset?: {
		bottom?: string;
		right?: string;
	};
	/** FAB 按钮尺寸规格：small (40px) / regular (56px)，默认 regular */
	size?: "small" | "regular";
	/** 悬浮按钮组列表（按自下而上顺序堆叠） */
	items: FabItemConfig[];
}
