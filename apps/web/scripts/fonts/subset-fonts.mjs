import {
	existsSync,
	mkdirSync,
	readFileSync,
	renameSync,
	rmSync,
	statSync,
	writeFileSync,
} from "node:fs";
import { basename, extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import subsetFont from "subset-font";
import { fontConfig } from "../../src/config/fontConfig.ts";
import { collectAllText } from "./text-collector.mjs";

const projectRoot = fileURLToPath(new URL("../../", import.meta.url));
const subsetDir = join(projectRoot, "src/assets/fonts/.subset");

export function createWoff2Subset(sourceFont, text) {
	return subsetFont(sourceFont, text, { targetFormat: "woff2" });
}

export async function subsetAllFonts(options = {}) {
	const force = options.force ?? false;
	const isEnabled = fontConfig.subsetting?.enable ?? false;

	if (fontConfig.mode === "system" && !force) {
		console.log(
			'[subsetting] ℹ System font mode enabled (mode: "system"), skipping font subsetting',
		);
		return;
	}

	if (!isEnabled && !force) {
		console.log(
			"[subsetting] ℹ Font subsetting is disabled in fontConfig (subsetting.enable: false), skipping",
		);
		return;
	}

	console.log("[subsetting] Starting automated font subsetting pipeline...");

	// 1. 收集全站文本字符（包含 Markdown、i18n、配置及 Meting 歌曲信息）
	const allText = await collectAllText();
	if (!allText || allText.length === 0) {
		throw new Error(
			"[subsetting] ❌ No characters collected from site content/config/i18n. Subsetting cannot proceed.",
		);
	}

	mkdirSync(subsetDir, { recursive: true });
	const charsetFile = join(subsetDir, "charset.txt");
	writeFileSync(charsetFile, allText, "utf8");
	console.log(
		`[subsetting] ✓ Collected ${allText.length} unique characters across site & music sources`,
	);

	// 2. 获取配置中的所有 local 来源字体
	const localVariants = fontConfig.fontFamilies
		.filter((f) => f.source === "local")
		.flatMap((f) => f.variants);

	if (localVariants.length === 0) {
		console.log("[subsetting] ℹ No local font variants to subset");
		return;
	}

	const maxFamilyBytes = fontConfig.budget?.maxFamilyBytes ?? 4 * 1024 * 1024;

	for (const variant of localVariants) {
		const originalPath = join(projectRoot, variant.file);
		if (!existsSync(originalPath)) {
			throw new Error(
				`[subsetting] ❌ Source font file not found: ${originalPath}`,
			);
		}

		const ext = extname(variant.file);
		const baseName = basename(variant.file, ext);
		const outputPath = join(subsetDir, `${baseName}.subset.woff2`);
		const tempOutputPath = join(
			subsetDir,
			`${baseName}.subset.${Date.now()}.tmp`,
		);

		console.log(
			`[subsetting] Processing ${baseName}${ext} -> ${baseName}.subset.woff2`,
		);
		const startTime = Date.now();

		try {
			const sourceFont = readFileSync(originalPath);
			const subsetBuffer = await createWoff2Subset(sourceFont, allText);
			writeFileSync(tempOutputPath, subsetBuffer);

			if (!existsSync(tempOutputPath) || statSync(tempOutputPath).size === 0) {
				throw new Error(
					`Generated subset font file is empty or missing: ${tempOutputPath}`,
				);
			}

			const subsetBytes = statSync(tempOutputPath).size;
			if (subsetBytes > maxFamilyBytes) {
				throw new Error(
					`Subset font ${baseName}.subset.woff2 (${subsetBytes} bytes) exceeds family budget (${maxFamilyBytes} bytes)`,
				);
			}

			// 原子替换
			renameSync(tempOutputPath, outputPath);

			const originalBytes = statSync(originalPath).size;
			const reduction = (
				((originalBytes - subsetBytes) / originalBytes) *
				100
			).toFixed(1);
			const durationMs = Date.now() - startTime;

			console.log(
				`[subsetting] ✓ ${baseName}: ${(originalBytes / 1024 / 1024).toFixed(2)} MB -> ${(subsetBytes / 1024).toFixed(1)} KB (-${reduction}%) in ${durationMs}ms`,
			);
		} catch (error) {
			if (existsSync(tempOutputPath)) {
				try {
					rmSync(tempOutputPath, { force: true });
				} catch {
					// ignore cleanup error
				}
			}
			console.error(
				`[subsetting] ❌ Failed to subset ${baseName}: ${error.message}`,
			);
			throw error;
		}
	}

	console.log(
		"[subsetting] All font subsetting tasks completed successfully!\n",
	);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
	await subsetAllFonts({ force: true });
}
