/**
 * 配置内省子进程：import 各 `src/config/<domain>Config.ts` 并把结果以 JSON 打到 stdout。
 *
 * 两种模式：
 * - `--mode=effective`：直接 import，得到「主题默认值 ⊕ 内容仓覆盖」的生效值；
 * - `--mode=defaults`：注册 `config-introspect-hooks.mjs`，把 `src/user/user-config.ts`
 *   换成空覆盖层，于是 `withUserConfig()` 原样返回默认值字面量。
 *
 * 之所以独立成进程而不是在主进程里做：ESM 的模块缓存不可清除，
 * 同一进程内 import 过一次带覆盖的配置之后就再也拿不到默认值了。
 *
 * 单个领域 import 失败不让整个内省失败：把错误按领域记下来，由调用方决定是告警还是熔断。
 * 这样一个坏领域不会挡住其余 21 个领域的导出。
 */

import { register } from "node:module";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { GENERATED_CONFIG_FILE } from "./config-domains.mjs";

function argValue(name, fallback = "") {
	const prefix = `--${name}=`;
	const found = process.argv.slice(2).find((arg) => arg.startsWith(prefix));
	return found === undefined ? fallback : found.slice(prefix.length);
}

const mode = argValue("mode", "effective");
const root = resolve(argValue("root", process.cwd()));
const domains = argValue("domains")
	.split(",")
	.map((value) => value.trim())
	.filter(Boolean);

if (mode === "defaults") {
	register(
		pathToFileURL(resolve(import.meta.dirname, "config-introspect-hooks.mjs"))
			.href,
		{
			data: {
				target: pathToFileURL(resolve(root, GENERATED_CONFIG_FILE)).href,
			},
		},
	);
}

const values = {};
const errors = {};
/**
 * `effective` 模式下附带读出当前生效的覆盖层原文。
 *
 * 调用方靠它判断「代码仓已物化的覆盖层」与「内容仓 config/*.yaml 现状」是否一致：
 * 不一致说明生效值是过期快照，此时反向导出会把旧值写回内容仓，静默覆盖用户在那边的新改动。
 */
let overrides = null;

if (mode === "effective") {
	try {
		const module = await import(
			pathToFileURL(resolve(root, GENERATED_CONFIG_FILE)).href
		);
		overrides = module.userConfigOverrides ?? {};
	} catch (error) {
		// 生成物缺失（例如尚未同步过）不是致命错误：视作「没有任何覆盖」。
		errors["(overrides)"] =
			error instanceof Error ? error.message : String(error);
	}
}

for (const key of domains) {
	const modulePath = resolve(root, "src", "config", `${key}Config.ts`);
	try {
		const module = await import(pathToFileURL(modulePath).href);
		const value = module[`${key}Config`];
		if (value === undefined) {
			errors[key] = `${key}Config.ts does not export ${key}Config`;
			continue;
		}
		// 归一化成纯 JSON：配置树里若混进 undefined / Symbol 键，差分阶段会得出错误结论。
		// 21 个领域都已核实是 JSON 可序列化的，这里是防回归的护栏而非补救。
		values[key] = JSON.parse(JSON.stringify(value));
	} catch (error) {
		errors[key] = error instanceof Error ? error.message : String(error);
	}
}

process.stdout.write(JSON.stringify({ mode, values, errors, overrides }));
