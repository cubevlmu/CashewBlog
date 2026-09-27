/**
 * 配置覆盖层：把内容仓 `config/*.yaml` 的用户覆盖合并进主题默认配置。
 *
 * 每个 `src/config/<domain>Config.ts` 把自己的字面量默认值交给 `withUserConfig()`，
 * 默认值本身（连同注释这份文档）留在代码仓，用户覆盖留在内容仓，二者互不污染。
 *
 * 合并规则：**对象递归合并，数组整体替换**。
 * 数组不做逐项合并，因为 `sidebarConfig.components`、`profileConfig.links` 这类清单
 * 的语义是「这就是我要的全部条目」，逐项合并会让「删掉一项」变得无法表达。
 *
 * 覆盖值的键名与取值在生成期就已经由 `tsc` 对着 `src/types/*Config.ts` 校验过
 * （见 `scripts/content/config-overlay.mjs`），因此这里只做合并，不重复校验。
 *
 * `local` 模式下 `userConfigOverrides` 是空对象，`withUserConfig()` 原样返回默认值，
 * 零额外开销。契约见 `docs/content-separation/config-overlay.md`。
 */

import { userConfigOverrides } from "../user/user-config.ts";

function isPlainObject(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function deepMerge(base: unknown, override: unknown): unknown {
	if (!isPlainObject(base) || !isPlainObject(override)) return override;

	const merged: Record<string, unknown> = { ...base };
	for (const [key, value] of Object.entries(override)) {
		merged[key] = key in base ? deepMerge(base[key], value) : value;
	}
	return merged;
}

/**
 * 返回「主题默认值 ⊕ 用户覆盖」。用户未覆盖该领域时原样返回 `defaults`。
 *
 * @param domain 领域名，与内容仓 `config/` 下的文件名一一对应（`site` ↔ `config/site.yaml`）
 * @param defaults 该领域的主题默认值字面量
 */
export function withUserConfig<T>(domain: string, defaults: T): T {
	const override = userConfigOverrides[domain];
	if (override === undefined) return defaults;
	return deepMerge(defaults, override) as T;
}

/**
 * 取某个领域的原始用户覆盖值，不做合并。
 *
 * 供无法用「默认值 ⊕ 覆盖」表达的领域使用：`navBarConfig` 的条目要引用 `LinkPresets`
 * 并调用 `i18n()`，深合并只会得到一堆未解析的引用，必须由领域自己翻译。
 */
export function getUserConfig(domain: string): unknown {
	return userConfigOverrides[domain];
}
