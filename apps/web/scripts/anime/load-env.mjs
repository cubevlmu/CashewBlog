import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = fileURLToPath(new URL("../../", import.meta.url));

/**
 * 安全加载本地 .env 文件至 process.env
 */
export function loadEnvFile(envPath = join(projectRoot, ".env")) {
	if (!existsSync(envPath)) return;

	try {
		const content = readFileSync(envPath, "utf-8");
		const lines = content.split(/\r?\n/);

		for (const line of lines) {
			const trimmed = line.trim();
			if (!trimmed || trimmed.startsWith("#")) continue;

			const eqIndex = trimmed.indexOf("=");
			if (eqIndex === -1) continue;

			const key = trimmed.slice(0, eqIndex).trim();
			let val = trimmed.slice(eqIndex + 1).trim();

			// 去除首尾引号
			if (
				(val.startsWith('"') && val.endsWith('"')) ||
				(val.startsWith("'") && val.endsWith("'"))
			) {
				val = val.slice(1, -1);
			}

			if (key && process.env[key] === undefined) {
				process.env[key] = val;
			}
		}
	} catch {
		// 忽略无法读取的情况
	}
}
