/**
 * 静态配置统一出口（barrel）：消费方一律 `import { xxx } from "@/config"`。
 *
 * 这里只保留「开发者决定、不由管理员设置」的前端配置（FAB、右键菜单、图片光晕、
 * 代码块主题、字体、集成选项）。站点标题、主题色、导航、侧栏、横幅等管理员设置
 * 在运行时来自 `/api/site/bootstrap`，经 `Astro.locals.site`（src/lib/site）提供。
 */

export {
	type ArticleDiscoveryOptions,
	type ArticleShareOptions,
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
export {
	imageBloomConfig,
	resolveImageBloomOptions,
} from "./imageBloomConfig";
export { POST_CARD_MIN_WIDTH } from "./postListConfig";
