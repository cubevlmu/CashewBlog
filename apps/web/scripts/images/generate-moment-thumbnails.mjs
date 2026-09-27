import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const sourceDir = path.resolve("public/images/moments");
const outputDir = path.resolve("public/assets/moments/thumbnails");
const cachePath = path.join(outputDir, ".cache.json");
const widths = [192, 384, 640];
const supportedExtensions = new Set([
	".avif",
	".jpeg",
	".jpg",
	".png",
	".webp",
]);

async function collectImages(directory) {
	let entries;
	try {
		entries = await fs.readdir(directory, { withFileTypes: true });
	} catch {
		// 内容仓可以不提供说说图片，此时目录不存在属于正常情况。
		return [];
	}
	const images = [];
	for (const entry of entries) {
		const absolutePath = path.join(directory, entry.name);
		if (entry.isDirectory()) {
			images.push(...(await collectImages(absolutePath)));
		} else if (
			supportedExtensions.has(path.extname(entry.name).toLowerCase())
		) {
			images.push(absolutePath);
		}
	}
	return images;
}

/**
 * 新鲜度按源图内容哈希判断，而不是 mtime。
 *
 * CI 每次 checkout（以及 `pnpm content:sync` 的物化）都会写出全新的 mtime，
 * 基于时间戳的比较在 CI 上必然全部未命中，导致每次构建都全量重生成缩略图。
 */
async function readCache() {
	try {
		const parsed = JSON.parse(await fs.readFile(cachePath, "utf8"));
		return parsed && typeof parsed === "object" && !Array.isArray(parsed)
			? parsed
			: {};
	} catch {
		return {};
	}
}

async function hashFile(filePath) {
	return createHash("sha256")
		.update(await fs.readFile(filePath))
		.digest("hex");
}

async function hasUsableOutput(outputPath) {
	try {
		return (await fs.stat(outputPath)).size > 0;
	} catch {
		return false;
	}
}

const images = await collectImages(sourceDir);
const previousCache = await readCache();
const nextCache = {};
const expectedOutputs = new Set();
let generated = 0;

for (const sourcePath of images) {
	const relativePath = path.relative(sourceDir, sourcePath);
	const cacheKey = relativePath.split(path.sep).join("/");
	const digest = await hashFile(sourcePath);
	const parsed = path.parse(relativePath);

	for (const width of widths) {
		const outputPath = path.join(
			outputDir,
			parsed.dir,
			`${parsed.name}-${width}.webp`,
		);
		expectedOutputs.add(path.resolve(outputPath).toLowerCase());
		if (
			previousCache[cacheKey] === digest &&
			(await hasUsableOutput(outputPath))
		) {
			continue;
		}
		await fs.mkdir(path.dirname(outputPath), { recursive: true });
		await sharp(sourcePath)
			.rotate()
			.resize({ width, withoutEnlargement: true })
			.webp({ quality: 64, effort: 5, smartSubsample: true })
			.toFile(outputPath);
		generated += 1;
	}

	nextCache[cacheKey] = digest;
}

await fs.mkdir(outputDir, { recursive: true });
let removed = 0;
for (const outputPath of await collectImages(outputDir)) {
	if (expectedOutputs.has(path.resolve(outputPath).toLowerCase())) continue;
	await fs.unlink(outputPath);
	removed += 1;
}

await fs.writeFile(cachePath, `${JSON.stringify(nextCache, null, 2)}\n`);

console.log(
	`[moment-thumbnails] ${generated > 0 ? `Generated ${generated}` : "Reused"} thumbnail assets for ${images.length} images${removed > 0 ? `; removed ${removed} stale files` : ""}.`,
);
