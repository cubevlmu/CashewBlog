import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { animeConfig } from "../../src/config/animeConfig.ts";
import { fontConfig } from "../../src/config/fontConfig.ts";
import { musicConfig } from "../../src/config/musicConfig.ts";
import { buildMetingUrl } from "../../src/utils/music/meting.ts";

const projectRoot = fileURLToPath(new URL("../../", import.meta.url));

async function walkDirectory(dir, filterExts) {
	if (!existsSync(dir)) return [];
	const entries = await readdir(dir, { withFileTypes: true });
	const files = [];
	for (const entry of entries) {
		const fullPath = join(dir, entry.name);
		if (entry.isDirectory()) {
			files.push(...(await walkDirectory(fullPath, filterExts)));
		} else if (filterExts.includes(extname(entry.name).toLowerCase())) {
			files.push(fullPath);
		}
	}
	return files;
}

/**
 * 收集全站文本字符集合
 */
export async function collectAllText() {
	const charSet = new Set();

	// 1. 通用基础字符集（ASCII 0x20..0x7E + 常用中日文标点符号 + 数字与常用拉丁）
	if (fontConfig.subsetting?.includeCommon ?? true) {
		for (let code = 32; code <= 126; code++) {
			charSet.add(String.fromCharCode(code));
		}
		const commonSymbols =
			"，。！？；：、‘’“”【】《》（）—…·「」『』〔〕｛｝“”〜～￥$€£%^&*+-*/=<>#@~`|\\_";
		for (const ch of commonSymbols) charSet.add(ch);
	}

	// 2. 收集 src/content/ 下所有文章 Markdown / MDX，以及 src/data/ 下的页面数据实体
	if (fontConfig.subsetting?.includeContent ?? true) {
		const contentFiles = await walkDirectory(join(projectRoot, "src/content"), [
			".md",
			".mdx",
		]);
		// 项目 / 技能 / 时间线 / 设备 / 友链 / 罗盘的正文都住在 src/data/*.ts，
		// 与文章一样是会被渲染出来的站点文本。内容分离后这些文件由内容仓提供，
		// 漏扫的直接后果是子集字体缺字。
		// （.json 番剧快照不在此列，它受 allowRemoteText 单独管辖。）
		const dataFiles = await walkDirectory(join(projectRoot, "src/data"), [
			".ts",
			".js",
		]);
		for (const file of [...contentFiles, ...dataFiles]) {
			const text = await readFile(file, "utf8");
			for (const ch of text) {
				if (ch.charCodeAt(0) > 31) charSet.add(ch);
			}
		}
	}

	// 3. 收集 src/i18n/ 下全部 10 种语言词典
	if (fontConfig.subsetting?.includeI18n ?? true) {
		const i18nFiles = await walkDirectory(join(projectRoot, "src/i18n"), [
			".ts",
			".js",
		]);
		for (const file of i18nFiles) {
			const text = await readFile(file, "utf8");
			for (const ch of text) {
				if (ch.charCodeAt(0) > 31) charSet.add(ch);
			}
		}
	}

	// 4. 收集 src/config/ 下所有站点配置与导航，以及内容仓生成的用户配置覆盖层
	if (fontConfig.subsetting?.includeConfig ?? true) {
		const configFiles = await walkDirectory(join(projectRoot, "src/config"), [
			".ts",
			".js",
		]);
		// external 模式下站点标题、公告、分类标签等文本只存在于覆盖层里，
		// 默认值那份反而不会被渲染。
		const userConfigFiles = await walkDirectory(join(projectRoot, "src/user"), [
			".ts",
			".js",
		]);
		for (const file of [...configFiles, ...userConfigFiles]) {
			const text = await readFile(file, "utf8");
			for (const ch of text) {
				if (ch.charCodeAt(0) > 31) charSet.add(ch);
			}
		}
	}

	// 5. 处理音乐模块文字（覆盖 local / custom / meting / mixed 四种模式）
	await collectMusicText(charSet);

	// 6. 处理番剧模块文字（依据 docs/remote-data-system.md 规范，纯本地离线扫描 local 数据与落盘快照）
	await collectAnimeText(charSet);

	return Array.from(charSet).sort().join("");
}

/**
 * 依据音乐模式精准采集曲目信息
 */
async function collectMusicText(charSet) {
	if (!musicConfig.enable) return;

	const provider = musicConfig.provider ?? "local";

	// 模式 A & D：本地模式 (local) 或 混合模式 (mixed) -> 扫描本地曲目数据
	if (provider === "local" || provider === "mixed") {
		const localMusicFile = join(projectRoot, "src/data/music.ts");
		if (existsSync(localMusicFile)) {
			const text = await readFile(localMusicFile, "utf8");
			for (const ch of text) {
				if (ch.charCodeAt(0) > 31) charSet.add(ch);
			}
		}
	}

	// 模式 B：自定义曲目列表 (custom) -> 扫描自定义配置曲目
	if (provider === "custom" && Array.isArray(musicConfig.tracks)) {
		for (const track of musicConfig.tracks) {
			const combined = `${track.title || ""} ${track.artist || ""}`;
			for (const ch of combined) {
				if (ch.charCodeAt(0) > 31) charSet.add(ch);
			}
		}
	}

	// 模式 C & D：网络歌单模式 (meting) 或 混合模式 (mixed) -> 抓取 Meting 远端歌单（受 allowRemoteText 配置控制）
	if (
		(provider === "meting" || provider === "mixed") &&
		musicConfig.meting &&
		musicConfig.meting.id &&
		(fontConfig.subsetting?.allowRemoteText ?? false)
	) {
		const url = buildMetingUrl(musicConfig.meting);
		if (url) {
			console.log(`[subsetting] Fetching Meting playlist text: ${url}`);
			try {
				const controller = new AbortController();
				const timeoutId = setTimeout(() => controller.abort(), 8000);
				const res = await fetch(url, {
					signal: controller.signal,
					headers: {
						"User-Agent":
							"Mozilla/5.0 (Windows NT 10.0; Win64; x64) Shirone/1.0",
					},
				});
				clearTimeout(timeoutId);

				if (res.ok) {
					const data = await res.json();
					if (Array.isArray(data)) {
						let songCount = 0;
						for (const song of data) {
							const title = song.name ?? song.title ?? "";
							const artist = song.artist ?? song.author ?? "";
							const str = `${title} ${artist}`;
							if (str.trim()) {
								songCount++;
								for (const ch of str) {
									if (ch.charCodeAt(0) > 31) charSet.add(ch);
								}
							}
						}
						console.log(
							`[subsetting] ✓ Collected text from ${songCount} Meting remote songs`,
						);
					}
				} else {
					console.warn(
						`[subsetting] ⚠ Meting API returned HTTP ${res.status}, skipping remote song text`,
					);
				}
			} catch (error) {
				console.warn(
					`[subsetting] ⚠ Failed to fetch Meting playlist text (${error.message}), continuing with local charset`,
				);
			}
		}
	}
}

/**
 * 依据番剧配置采集本地数据与已落盘快照文本
 * 严格遵循 docs/remote-data-system.md §3.2：绝不在子集化时发起外部网络请求，仅读取本地静态文件
 */
async function collectAnimeText(charSet) {
	if (!animeConfig.enable) return;

	// 1. 扫描本地手写番剧数据 (src/data/anime.ts)
	const localAnimeFile = join(projectRoot, "src/data/anime.ts");
	if (existsSync(localAnimeFile)) {
		const text = await readFile(localAnimeFile, "utf8");
		for (const ch of text) {
			if (ch.charCodeAt(0) > 31) charSet.add(ch);
		}
	}

	// 2. 若允许远端文本落盘分析，扫描已下载生成的本地快照 JSON (src/data/anime-snapshots/*.json)
	if (fontConfig.subsetting?.allowRemoteText ?? false) {
		const snapshotDir = join(
			projectRoot,
			animeConfig.snapshot?.directory || "src/data/anime-snapshots",
		);
		if (existsSync(snapshotDir)) {
			const snapshotFiles = await walkDirectory(snapshotDir, [".json"]);
			for (const file of snapshotFiles) {
				const text = await readFile(file, "utf8");
				for (const ch of text) {
					if (ch.charCodeAt(0) > 31) charSet.add(ch);
				}
			}
			if (snapshotFiles.length > 0) {
				console.log(
					`[subsetting] ✓ Collected text from ${snapshotFiles.length} anime snapshot files`,
				);
			}
		}
	}
}

// 允许单独作为 CLI 运行以供快速排查
if (process.argv[1] === fileURLToPath(import.meta.url)) {
	const allText = await collectAllText();
	console.log(
		`\nTotal unique characters collected: ${allText.length} characters\n`,
	);
	console.log(`Preview (first 120 chars): ${allText.slice(0, 120)}...`);
}
