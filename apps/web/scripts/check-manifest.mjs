// 校验 atoms/manifest.json 与文件系统一致性（Phase 0 清单单一真源）。
// 用法：node scripts/check-manifest.mjs
// 通过 = 每个 manifest 条目都有对应文件，且每个原子文件都被 manifest 登记，分类一致。
// 失败 = 打印差异清单并 exit 1。

import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, relative, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const atomsDir = join(root, "src", "components", "atoms");
const manifestPath = join(atomsDir, "manifest.json");

const VALID_TIERS = new Set(["A", "B", "C", "watch"]);
const VALID_SOURCES = new Set(["移植", "原创"]);
const CATEGORIES = new Set([
	"action",
	"blog",
	"display",
	"feedback",
	"input",
	"navigation",
	"overlay",
	"selection",
]);

// 演示页 / 索引不视为原子
const isSkipFile = (name) =>
	name.endsWith("Demo.svelte") ||
	name.endsWith("Demo.astro") ||
	name === "AtomIndex.svelte" ||
	name === "index.astro";

function scanAtoms(dir) {
	const found = [];
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		const full = join(dir, entry.name);
		if (entry.isDirectory()) {
			// 跳过演示页子目录 atoms/atoms/
			if (entry.name === "atoms") continue;
			found.push(...scanAtoms(full));
		} else if (
			(entry.name.endsWith(".svelte") || entry.name.endsWith(".astro")) &&
			!isSkipFile(entry.name)
		) {
			found.push(relative(atomsDir, full).replaceAll("\\", "/"));
		}
	}
	return found;
}

function fail(msg) {
	console.error("✗ " + msg);
	process.exitCode = 1;
}

const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const atoms = manifest.atoms ?? [];
const errors = [];

// 1. schema 校验
const seen = new Set();
for (const a of atoms) {
	for (const key of ["name", "file", "category", "tier", "source"]) {
		if (!a[key]) errors.push(`条目缺字段 ${key}：${JSON.stringify(a)}`);
	}
	if (!VALID_TIERS.has(a.tier)) errors.push(`非法 tier "${a.tier}"：${a.file}`);
	if (!VALID_SOURCES.has(a.source))
		errors.push(`非法 source "${a.source}"：${a.file}`);
	if (!CATEGORIES.has(a.category))
		errors.push(`非法 category "${a.category}"：${a.file}`);
	if (seen.has(a.file)) errors.push(`重复 file：${a.file}`);
	seen.add(a.file);
}

// 2. manifest → 文件系统（每个条目文件存在，且分类与路径一致）
for (const a of atoms) {
	const full = join(atomsDir, ...a.file.split("/"));
	if (!existsSync(full)) {
		errors.push(`manifest 登记但文件不存在：${a.file}`);
		continue;
	}
	const pathCategory = a.file.split("/")[0];
	if (a.category !== pathCategory) {
		errors.push(
			`分类不一致：${a.file} 标注 ${a.category}，路径为 ${pathCategory}`,
		);
	}
}

// 3. 文件系统 → manifest（每个原子文件都被登记）
const onDisk = scanAtoms(atomsDir);
const manifestFiles = new Set(atoms.map((a) => a.file));
for (const f of onDisk) {
	if (!manifestFiles.has(f)) {
		errors.push(`文件未登记进 manifest：${f}`);
	}
}

// 4. 汇总
const byTier = {};
const byCat = {};
let landed = 0;
for (const a of atoms) {
	byTier[a.tier] = (byTier[a.tier] ?? 0) + 1;
	byCat[a.category] = (byCat[a.category] ?? 0) + 1;
	if (a.landed) landed += 1;
}

console.log(`atoms 总数: ${atoms.length}（磁盘 ${onDisk.length}）`);
console.log(`tier: ${JSON.stringify(byTier)}`);
console.log(`category: ${JSON.stringify(byCat)}`);
console.log(
	`landed: ${landed}/${atoms.length} = ${Math.round((landed / atoms.length) * 100)}%`,
);

if (errors.length) {
	console.error(`\n发现 ${errors.length} 处不一致：`);
	for (const e of errors) fail(e);
	process.exit(1);
} else {
	console.log("\n✓ manifest 与文件系统一致");
}
