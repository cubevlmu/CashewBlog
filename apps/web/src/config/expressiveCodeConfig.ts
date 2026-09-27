import type { ExpressiveCodeConfig } from "@/types/config";

/**
 * Expressive Code 代码块主题（astro.config.mjs 与 setting-utils 消费）。
 * 类型见 src/types/config.ts。
 */
export const expressiveCodeConfig: ExpressiveCodeConfig = {
		// Note: Some styles (such as background color) are being overridden, see the astro.config.mjs file.
		// 代码块跟随明暗模式切换深浅主题
		theme: "github-dark",
		lightTheme: "github-light",
		darkTheme: "github-dark",
};
