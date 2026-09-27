/**
 * 内省用的模块钩子：把 `src/user/user-config.ts` 拦截成空覆盖层。
 *
 * 由 `config-introspect-worker.mjs` 在 `--mode=defaults` 时通过 `module.register()` 注册。
 * 钩子跑在独立线程上，因此目标 URL 只能通过 `initialize` 的 `data` 传进来。
 *
 * 只挂 `load` 不挂 `resolve`：`resolve` 返回自定义 scheme 会连带影响该模块的相对导入解析，
 * 而这里要的只是「同一个 URL，换一份源码」。
 */

/** @type {string} 目标模块的 file:// URL，已小写化以适配 Windows 的大小写不敏感路径。 */
let target = "";

/** 与 `config-overlay.mjs` 的 `EMPTY_MODULE` 语义等价的最小实现（此处不需要注释与类型标注）。 */
const EMPTY_SOURCE = [
	"export const userConfigOverrides = {};",
	"export const userConfigSources = [];",
	"",
].join("\n");

export async function initialize(data) {
	target = String(data?.target ?? "").toLowerCase();
}

export async function load(url, context, nextLoad) {
	if (target && url.toLowerCase() === target) {
		return { format: "module", shortCircuit: true, source: EMPTY_SOURCE };
	}
	return nextLoad(url, context);
}
