/**
 * 导航配置类型。
 * pageKey：预设的页面标识，配合 nav-utils 的 resolvePageKey 统一驱动
 * 顶栏 / 抽屉高亮（含分类筛选、标签筛选等动态页面）。
 */
export type NavBarLink = {
	name: string;
	url?: string;
	icon?: string;
	/** 页面标识（home/archive/categories/tags/about/github…），驱动高亮 */
	pageKey?: string;
	external?: boolean;
	children?: NavBarLink[];
};

export type NavBarConfig = {
	links: NavBarLink[];
};

/**
 * 导航栏的声明式覆盖条目（内容仓 `config/nav-bar.yaml` 使用）。
 *
 * `navBarConfig` 本身要调用 `i18n()` 并引用 `LinkPresets`，无法用 YAML 直接表达，
 * 因此内容仓写的是这份「引用 + 字面量」的中间形态，由 `resolveNavBarLinks()` 还原成
 * `NavBarLink`。三种写法：
 * - `{ preset: "Home" }`：引用主题内置预设，可再带同名字段做局部覆盖；
 * - `{ name, url, icon }`：完全自定义的链接；
 * - `{ name, icon, children }`：下拉分组，children 递归使用同一套写法。
 *
 * `name` 支持 `"$t:home"` 形式引用 i18n 词条，其余按字面量处理。
 */
export type NavBarLinkOverride = {
	/** 引用 `LinkPresets` 中的预设名（如 "Home"、"GitHub"） */
	preset?: string;
	name?: string;
	url?: string;
	icon?: string;
	pageKey?: string;
	external?: boolean;
	children?: NavBarLinkOverride[];
};

export type NavBarConfigOverride = {
	links: NavBarLinkOverride[];
};
