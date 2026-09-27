// 校验 .agents/skills/ 下 AI 技能包的结构与引用完整性。
// 用法：node scripts/check-skills.mjs
// 通过 = 每个技能目录含 SKILL.md，frontmatter 合法（name 与目录一致、kebab-case、
//        shirone- 前缀、description 非空），正文引用的仓库路径全部真实存在。
// 失败 = 打印问题清单并 exit 1。

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const skillsDir = join(root, ".agents", "skills");

function fail(msg) {
	console.error(`✗ ${msg}`);
	process.exitCode = 1;
}

function parseFrontmatter(content) {
	const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(content);
	if (!match) return null;
	const fields = {};
	for (const line of match[1].split(/\r?\n/)) {
		const idx = line.indexOf(":");
		if (idx > 0) fields[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
	}
	return fields;
}

// 正文反引号 token 中，以仓库顶层目录开头的才视为路径引用并校验存在性；
// 别名导入（@/...）、站点路由（/...）、枚举值列表等一律跳过。
const REPO_ROOT_SEGMENTS = new Set([
	"src",
	"docs",
	"rules",
	"tests",
	"scripts",
	"public",
	".github",
	".agents",
]);

function extractRepoPaths(body) {
	const paths = new Set();
	for (const token of body.match(/`([^`\n]+)`/g) ?? []) {
		const value = token.slice(1, -1).replace(/\/+$/, "");
		if (!value.includes("/")) continue;
		if (/[\s<>{}*"'~]/.test(value)) continue;
		if (/^(@|\/|~|https?:\/\/)/.test(value)) continue;
		if (!REPO_ROOT_SEGMENTS.has(value.split("/")[0])) continue;
		paths.add(value);
	}
	return paths;
}

if (!existsSync(skillsDir) || !statSync(skillsDir).isDirectory()) {
	fail("技能目录不存在：.agents/skills/");
	process.exit(process.exitCode ?? 0);
}

const entries = readdirSync(skillsDir, { withFileTypes: true }).filter((e) =>
	e.isDirectory(),
);
let skillCount = 0;
let pathCount = 0;
const discoveredNames = new Set();

if (entries.length === 0) {
	fail("未发现任何技能目录");
}

for (const entry of entries) {
	const skillPath = join(skillsDir, entry.name, "SKILL.md");
	if (!existsSync(skillPath)) {
		fail(`${entry.name}/SKILL.md 缺失`);
		continue;
	}
	skillCount += 1;

	const content = readFileSync(skillPath, "utf8");
	const fields = parseFrontmatter(content);
	if (!fields) {
		fail(`${entry.name}/SKILL.md 缺少合法的 YAML frontmatter`);
		continue;
	}

	const name = fields.name ?? "";
	const description = fields.description ?? "";
	if (discoveredNames.has(name)) {
		fail(`重复的 skill name：${name}`);
	}
	discoveredNames.add(name);

	if (name !== entry.name) {
		fail(`${entry.name}/SKILL.md：name "${name}" 与目录名不一致`);
	}
	if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(name)) {
		fail(`${entry.name}/SKILL.md：name "${name}" 不是 kebab-case`);
	} else if (!name.startsWith("shirone-")) {
		fail(`${entry.name}/SKILL.md：name "${name}" 缺少 shirone- 前缀`);
	}
	if (!description) {
		fail(`${entry.name}/SKILL.md：description 为空`);
	} else if (description.length > 1024) {
		fail(`${entry.name}/SKILL.md：description 超过 1024 字符`);
	}

	// 正文中的相对路径必须真实存在，防止文档移动后技能漂移。
	for (const rel of extractRepoPaths(content)) {
		pathCount += 1;
		if (!existsSync(join(root, ...rel.split("/")))) {
			fail(`${entry.name}/SKILL.md 引用了不存在的路径：${rel}`);
		}
	}
}

// README 是技能目录的公开索引；校验其中的 skill 链接与磁盘目录保持一致。
const readmePath = join(skillsDir, "README.md");
if (existsSync(readmePath)) {
	const readme = readFileSync(readmePath, "utf8");
	const listedNames = new Set();
	for (const match of readme.matchAll(
		/\[(shirone-[a-z0-9-]+)\]\((shirone-[a-z0-9-]+)\/SKILL\.md\)/g,
	)) {
		if (match[1] !== match[2]) {
			fail(`README.md 技能名称与路径不一致：${match[1]} -> ${match[2]}`);
		}
		listedNames.add(match[1]);
	}
	for (const name of discoveredNames) {
		if (!listedNames.has(name)) fail(`README.md 未列出技能：${name}`);
	}
	for (const name of listedNames) {
		if (!discoveredNames.has(name))
			fail(`README.md 列出了不存在的技能：${name}`);
	}
}

console.log(`skills 总数: ${skillCount}，校验路径引用: ${pathCount}`);
if (process.exitCode) {
	console.error("\n✗ skills 校验未通过");
	process.exit(1);
} else {
	console.log("\n✓ skills 结构与路径引用一致");
}
