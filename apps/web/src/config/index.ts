/**
 * 配置统一出口（barrel）：消费方一律 `import { xxx } from "@/config"`。
 *
 * 约定（详见本目录 README.md）：
 * - 值放在 `src/config/<domain>Config.ts`，类型放在 `src/types/<domain>Config.ts`；
 * - 存在反向依赖的模块（如 i18n/translation.ts 依赖 siteConfig）只允许从
 *   具体文件导入（`@/config/siteConfig`），禁止走本 barrel，避免循环依赖。
 */

export { aboutConfig } from "./aboutConfig";
export { announcementConfig } from "./announcementConfig";
export {
	type ArticleDiscoveryOptions,
	type ArticleShareOptions,
	articleConfig,
	normalizeDiscoveryCount,
	resolveArticleDiscoveryOptions,
	resolveArticleShareOptions,
	resolveLastUpdatedNoticeOptions,
} from "./articleConfig";
export { contextMenuConfig } from "./contextMenuConfig";
export { expressiveCodeConfig } from "./expressiveCodeConfig";
export { fabConfig } from "./fabConfig";
export {
	fontConfig,
	resolvedFontOptions,
	resolveFontOptions,
} from "./fontConfig";
export { footerConfig } from "./footerConfig";
export { i18nConfig } from "./i18nConfig";
export {
	imageBloomConfig,
	resolveImageBloomOptions,
} from "./imageBloomConfig";
export { LinkPresets, navBarConfig } from "./navBarConfig";
export { POST_CARD_MIN_WIDTH, postListConfig } from "./postListConfig";
export { profileConfig } from "./profileConfig";
export { seriesConfig } from "./seriesConfig";
export { sidebarConfig } from "./sidebarConfig";
export {
	getDefaultSpec,
	getDefaultStyle,
	resolveDisplaySettings,
	resolveTextureOptions,
	siteConfig,
} from "./siteConfig";
export {
	type ResolvedUmamiOptions,
	resolveUmamiOptions,
	umamiConfig,
} from "./umamiConfig";
