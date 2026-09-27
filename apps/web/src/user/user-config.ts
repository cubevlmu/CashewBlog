/**
 * 用户配置覆盖层（由 `pnpm content:sync` 生成，请勿手工编辑）。
 *
 * `local` 模式下本文件保持为空对象，全站行为完全由 `src/config/*Config.ts` 的默认值决定。
 * `external` 模式下 `scripts/content/config-overlay.mjs` 会把内容仓 `config/*.yaml`
 * 校验、归一化之后写进 `userConfigOverrides`，再由 `withUserConfig()` 在各配置文件里深合并。
 *
 * 放在 `src/user/` 而不是 `src/generated/` 是有意为之：
 * `scripts/icons/generate-local-icons.mjs` 会跳过 `src/generated/`，
 * 只在用户配置里出现的图标（如 `profile.links[].icon`）会因此漏扫。
 *
 * 契约见 `docs/content-separation/config-overlay.md`。
 */

/** 领域名 -> 该领域的用户覆盖值（仅包含用户显式声明的键）。 */
export const userConfigOverrides: Readonly<Record<string, unknown>> = {};

/** 本次生成消费了内容仓中的哪些文件，用于溯源与错误提示。 */
export const userConfigSources: readonly string[] = [];
