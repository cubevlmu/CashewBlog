import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
	existsSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	symlinkSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const EJECT_SCRIPT = fileURLToPath(
	new URL("../../scripts/content/eject.mjs", import.meta.url),
);

function write(root, relativePath, contents = "x") {
	const absolute = join(root, relativePath);
	mkdirSync(dirname(absolute), { recursive: true });
	writeFileSync(absolute, contents);
}

function git(cwd, args) {
	return execFileSync("git", args, {
		cwd,
		encoding: "utf8",
		stdio: ["ignore", "pipe", "pipe"],
	}).trim();
}

/** 造一个已提交的代码仓骨架，包含用户内容、主题自有资产与构建期生成物。 */
function createFixture() {
	const base = mkdtempSync(join(tmpdir(), "shirone-eject-"));
	const repo = join(base, "repo");
	mkdirSync(repo, { recursive: true });

	write(repo, ".gitignore", "dist/\n");
	write(repo, "src/content/posts/hello.md", "# hello");
	write(repo, "src/content/spec/about.md", "# about");
	write(repo, "src/data/projects.ts", "export const projectsData = [];");
	write(repo, "src/data/anime-snapshots/.gitkeep", "");
	write(repo, "src/assets/images/demo-avatar.webp", "avatar");
	write(repo, "src/assets/fonts/Theme-Font.ttf", "font");
	write(repo, "public/favicon/icon.svg", "<svg />");
	write(repo, "public/images/moments/photo.webp", "photo");
	write(repo, "public/assets/banner/desktop/1.webp", "banner");
	write(repo, "public/assets/anime/show.webp", "anime");
	write(repo, "public/assets/anime/covers/generated.webp", "generated");

	git(repo, ["init", "--quiet", "--initial-branch", "main"]);
	git(repo, ["config", "user.email", "test@example.com"]);
	git(repo, ["config", "user.name", "Test"]);
	git(repo, ["add", "-A"]);
	git(repo, ["commit", "--quiet", "-m", "init"]);

	return { base, repo, out: join(base, "content") };
}

function runEject(fixture, args = []) {
	return execFileSync(process.execPath, [EJECT_SCRIPT, ...args], {
		cwd: fixture.repo,
		encoding: "utf8",
		stdio: ["ignore", "pipe", "pipe"],
	});
}

describe("content eject", () => {
	it("默认只预演，不改动仓库", () => {
		const fixture = createFixture();
		try {
			const stdout = runEject(fixture, ["--out", fixture.out]);
			assert.match(stdout, /\[dry-run\]|dry run/i);
			assert.ok(!existsSync(fixture.out));
			assert.equal(git(fixture.repo, ["status", "--porcelain"]), "");
			assert.ok(!existsSync(join(fixture.repo, "shirone.content.json")));
		} finally {
			rmSync(fixture.base, { recursive: true, force: true });
		}
	});

	it("--dry-run 优先于 --yes，避免脚本化调用时误写", () => {
		const fixture = createFixture();
		try {
			const stdout = runEject(fixture, [
				"--yes",
				"--dry-run",
				"--out",
				fixture.out,
			]);
			assert.match(stdout, /\[dry-run\]|dry run/i);
			assert.ok(!existsSync(fixture.out));
			assert.equal(git(fixture.repo, ["status", "--porcelain"]), "");
		} finally {
			rmSync(fixture.base, { recursive: true, force: true });
		}
	});

	it("拒绝把导出目录指向代码仓本身或其子目录", () => {
		const fixture = createFixture();
		try {
			for (const target of [fixture.repo, join(fixture.repo, "content-repo")]) {
				assert.throws(
					() => runEject(fixture, ["--force", "--dry-run", "--out", target]),
					/overlap|status 1/i,
				);
			}
			assert.equal(git(fixture.repo, ["status", "--porcelain"]), "");
		} finally {
			rmSync(fixture.base, { recursive: true, force: true });
		}
	});

	it("目标尚不存在时也能识别父目录链接造成的代码仓重叠", () => {
		const fixture = createFixture();
		try {
			const alias = join(fixture.base, "repo-link");
			symlinkSync(
				fixture.repo,
				alias,
				process.platform === "win32" ? "junction" : "dir",
			);
			assert.throws(
				() =>
					runEject(fixture, [
						"--force",
						"--dry-run",
						"--out",
						join(alias, "future-content"),
					]),
				/overlap|status 1/i,
			);
			assert.equal(git(fixture.repo, ["status", "--porcelain"]), "");
		} finally {
			rmSync(fixture.base, { recursive: true, force: true });
		}
	});

	it("--yes 导出用户内容并保留主题自有资产", () => {
		const fixture = createFixture();
		try {
			runEject(fixture, ["--yes", "--out", fixture.out]);

			// 用户内容按内容仓布局导出。
			assert.ok(existsSync(join(fixture.out, "content/posts/hello.md")));
			assert.ok(existsSync(join(fixture.out, "content/spec/about.md")));
			assert.ok(existsSync(join(fixture.out, "data/projects.ts")));
			assert.ok(
				existsSync(join(fixture.out, "assets/images/demo-avatar.webp")),
			);
			assert.ok(
				existsSync(join(fixture.out, "public/images/moments/photo.webp")),
			);
			assert.ok(
				existsSync(join(fixture.out, "public/assets/banner/desktop/1.webp")),
			);
			assert.ok(existsSync(join(fixture.out, "public/assets/anime/show.webp")));

			// 主题自有资产与构建期生成物不导出。
			assert.ok(!existsSync(join(fixture.out, "assets/fonts/Theme-Font.ttf")));
			assert.ok(!existsSync(join(fixture.out, "public/favicon/icon.svg")));
			assert.ok(
				!existsSync(
					join(fixture.out, "public/assets/anime/covers/generated.webp"),
				),
			);
			assert.ok(
				!existsSync(join(fixture.out, "data/anime-snapshots/.gitkeep")),
			);

			// 内容仓起步文件。
			assert.ok(existsSync(join(fixture.out, "README.md")));
			assert.ok(
				existsSync(join(fixture.out, ".github/workflows/trigger-build.yml")),
			);
		} finally {
			rmSync(fixture.base, { recursive: true, force: true });
		}
	});

	it("--yes 让代码仓不再跟踪这些路径，但文件仍留在工作区", () => {
		const fixture = createFixture();
		try {
			runEject(fixture, ["--yes", "--out", fixture.out]);

			const tracked = git(fixture.repo, ["ls-files"]).split("\n");
			assert.ok(!tracked.includes("src/content/posts/hello.md"));
			assert.ok(!tracked.includes("src/data/projects.ts"));
			assert.ok(!tracked.includes("public/images/moments/photo.webp"));
			// 主题自有文件仍然跟踪。
			assert.ok(tracked.includes("src/assets/fonts/Theme-Font.ttf"));
			assert.ok(tracked.includes("public/favicon/icon.svg"));

			// 文件本身保留，物化后的首次 sync 因此是空操作。
			assert.ok(existsSync(join(fixture.repo, "src/content/posts/hello.md")));

			const gitignore = readFileSync(join(fixture.repo, ".gitignore"), "utf8");
			assert.match(gitignore, /^\/src\/content\/$/m);
			assert.match(gitignore, /^\/public\/assets\/anime\/\*\.webp$/m);
			// 原有规则不被破坏。
			assert.match(gitignore, /^dist\/$/m);
		} finally {
			rmSync(fixture.base, { recursive: true, force: true });
		}
	});

	it("--yes 写出指向导出目录的 shirone.content.json", () => {
		const fixture = createFixture();
		try {
			runEject(fixture, ["--yes", "--out", fixture.out]);
			const manifest = JSON.parse(
				readFileSync(join(fixture.repo, "shirone.content.json"), "utf8"),
			);
			assert.equal(manifest.schemaVersion, 1);
			assert.equal(manifest.source.type, "path");
			assert.match(manifest.source.path, /content$/);
		} finally {
			rmSync(fixture.base, { recursive: true, force: true });
		}
	});

	it("工作区不干净时拒绝执行", () => {
		const fixture = createFixture();
		try {
			write(fixture.repo, "src/content/posts/dirty.md", "# dirty");
			assert.throws(
				() => runEject(fixture, ["--yes", "--out", fixture.out]),
				/uncommitted changes|status 1/i,
			);
			assert.ok(!existsSync(fixture.out));
		} finally {
			rmSync(fixture.base, { recursive: true, force: true });
		}
	});

	it("导出目录非空时拒绝执行", () => {
		const fixture = createFixture();
		try {
			write(fixture.out, "existing.md", "keep me");
			assert.throws(
				() => runEject(fixture, ["--yes", "--out", fixture.out]),
				/not empty|status 1/i,
			);
			assert.ok(!existsSync(join(fixture.out, "content")));
		} finally {
			rmSync(fixture.base, { recursive: true, force: true });
		}
	});
});
