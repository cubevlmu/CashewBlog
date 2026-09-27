/**
 * Fancybox 配置模块
 * 提供图片灯箱的选择器和默认选项
 */

import type { FancyboxOptions } from "@fancyapps/ui";

// Fancybox 配置类型
export type FancyboxConfig = Partial<FancyboxOptions>;

// 默认 Fancybox 配置
export const getDefaultFancyboxConfig = (): FancyboxConfig => ({
	Carousel: {
		infinite: true,
		Lazyload: { preload: 3 },
		Thumbs: { showOnStart: true },
		Toolbar: {
			display: {
				left: ["counter"],
				middle: [
					"zoomIn",
					"zoomOut",
					"toggle1to1",
					"rotateCCW",
					"rotateCW",
					"flipX",
					"flipY",
					"reset",
				],
				right: ["autoplay", "fullscreen", "thumbs", "close"],
			},
		},
		Zoomable: {
			Panzoom: { maxScale: 3, minScale: 1 },
		},
	},
	dragToClose: true,
	keyboard: {
		Escape: "close",
		Delete: "close",
		Backspace: "close",
		PageUp: "next",
		PageDown: "prev",
		ArrowUp: "next",
		ArrowDown: "prev",
		ArrowRight: "next",
		ArrowLeft: "prev",
	},
});

// Fancybox 选择器
export const FANCYBOX_SELECTORS = {
	// 文章正文图片和封面图（排除画廊内图片，避免被整篇轮播组重复捕获）
	articleImages: ".custom-md img:not(.image-grid img), #post-cover img",

	// 画廊网格内带独立分组 ID 的链接（按 data-fancybox 值分组轮播）
	imageGrids: ".image-grid [data-fancybox]",

	// 带 data-fancybox 属性的其他元素（排除画廊链接，防止双绑）
	singleFancybox: "[data-fancybox]:not(.image-grid [data-fancybox])",
} as const;
