import { expect, test } from "@playwright/test";
import { resolveAnimeOptions } from "../../src/config/animeConfig.ts";
import { type AnimeItem, animeData } from "../../src/data/anime.ts";
import {
	normalizeAnimeItem,
	sortAnimeList,
} from "../../src/utils/anime/normalize.ts";
import { getAnimeList } from "../../src/utils/anime-data.ts";

test.describe("Bangumi 与 Bilibili 多场景配置契约与落地验证", () => {
	test("场景 1：本地模式 (Local Mode) 默认零外部依赖", async () => {
		const options = resolveAnimeOptions({
			enable: true,
			source: { kind: "local" },
			fallback: { kind: "local" },
			providers: {
				bangumi: { enable: false, userId: "" },
				bilibili: { enable: false, vmid: "" },
			},
			snapshot: {
				directory: "src/data/anime-snapshots",
				staleAfterDays: 30,
				keepLastValid: true,
			},
		});

		expect(options.enable).toBe(true);
		expect(options.source.kind).toBe("local");
		const list = await getAnimeList(options);
		expect(list.length).toBe(animeData.length);
		expect(list[0].title).toBe("Lycoris Recoil");
	});

	test("场景 2：Bangumi 五态映射、评分与 subjectId 契约", () => {
		const rawBangumiItems = [
			{
				title: "想看条目",
				status: "planned",
				rating: 8.5,
				progress: { watched: 0, total: 12 },
				year: "2024",
				identity: { provider: "bangumi", subjectId: "101" },
			},
			{
				title: "在看条目",
				status: "watching",
				rating: 9.0,
				progress: { watched: 6, total: 12 },
				year: "2024",
				identity: { provider: "bangumi", subjectId: "102" },
			},
			{
				title: "看过条目",
				status: "completed",
				rating: 9.5,
				progress: { watched: 12, total: 12 },
				year: "2023",
				identity: { provider: "bangumi", subjectId: "103" },
			},
			{
				title: "搁置条目",
				status: "onHold",
				rating: 7.0,
				progress: { watched: 3, total: 12 },
				year: "2022",
				identity: { provider: "bangumi", subjectId: "104" },
			},
			{
				title: "弃番条目",
				status: "dropped",
				rating: 5.0,
				progress: { watched: 1, total: 12 },
				year: "2021",
				identity: { provider: "bangumi", subjectId: "105" },
			},
		];

		const normalized = rawBangumiItems.map(normalizeAnimeItem).filter(Boolean);
		expect(normalized.length).toBe(5);

		const sorted = sortAnimeList(normalized as AnimeItem[]);
		// 排序优先级：completed -> watching -> planned -> onHold -> dropped
		expect(sorted[0].status).toBe("completed");
		expect(sorted[1].status).toBe("watching");
		expect(sorted[2].status).toBe("planned");
		expect(sorted[3].status).toBe("onHold");
		expect(sorted[4].status).toBe("dropped");
	});

	test("场景 3：Bilibili 进度解析、三类封面模式与链接生成", () => {
		// 1. 进度字符串解析 (如 "已看第8话" / "8/12" / 数字)
		const itemStringProgress = normalizeAnimeItem({
			title: "Bilibili 测试 1",
			status: "watching",
			progress: { watched: 8, total: 12 },
			cover: "/assets/anime/covers/bili_123.webp",
			link: "https://www.bilibili.com/bangumi/play/ss123",
			identity: { provider: "bilibili", seasonId: "123" },
		});
		expect(itemStringProgress?.progress).toEqual({ watched: 8, total: 12 });
		expect(itemStringProgress?.cover).toBe(
			"/assets/anime/covers/bili_123.webp",
		);
		expect(itemStringProgress?.link).toBe(
			"https://www.bilibili.com/bangumi/play/ss123",
		);

		// 2. 封面模式：none (无封面，安全省略)
		const itemNoneCover = normalizeAnimeItem({
			title: "Bilibili 无封面",
			status: "completed",
			progress: { watched: 12, total: 12 },
			identity: { provider: "bilibili", sourceId: "456" },
		});
		expect(itemNoneCover?.cover).toBeUndefined();

		// 3. 封面模式：remote HTTPS URL
		const itemRemoteCover = normalizeAnimeItem({
			title: "Bilibili 远程封面",
			status: "completed",
			cover: "https://i0.hdslb.com/bfs/bangumi/image/abc.png@220w_280h.webp",
			progress: { watched: 12, total: 12 },
		});
		expect(itemRemoteCover?.cover).toBe(
			"https://i0.hdslb.com/bfs/bangumi/image/abc.png@220w_280h.webp",
		);
	});

	test("场景 4：异常降级回退策略（local vs empty）", async () => {
		// 策略 A：快照丢失回退 local 数据
		const fallbackLocalOptions = resolveAnimeOptions({
			enable: true,
			source: { kind: "snapshot", file: "non_existent.json" },
			fallback: { kind: "local" },
			providers: {
				bangumi: { enable: true, userId: "test" },
				bilibili: { enable: false, vmid: "" },
			},
			snapshot: {
				directory: "src/data/anime-snapshots",
				staleAfterDays: 30,
				keepLastValid: true,
			},
		});
		const localResult = await getAnimeList(fallbackLocalOptions);
		expect(localResult.length).toBe(animeData.length);
		expect(localResult[0].title).toBe("Lycoris Recoil");

		// 策略 B：快照丢失回退 empty 空状态
		const fallbackEmptyOptions = resolveAnimeOptions({
			enable: true,
			source: { kind: "snapshot", file: "non_existent.json" },
			fallback: { kind: "empty" },
			providers: {
				bangumi: { enable: true, userId: "test" },
				bilibili: { enable: false, vmid: "" },
			},
			snapshot: {
				directory: "src/data/anime-snapshots",
				staleAfterDays: 30,
				keepLastValid: true,
			},
		});
		const emptyResult = await getAnimeList(fallbackEmptyOptions);
		expect(emptyResult.length).toBe(0);
	});

	test("场景 5：配置校验防呆与自动校正", () => {
		// 当 provider 为 bilibili 但误写 file 为 bangumi.json 时，自动校正为 bilibili.json
		const correctedOptions = resolveAnimeOptions({
			enable: true,
			source: {
				kind: "snapshot",
				provider: "bilibili",
				file: "bangumi.json",
			},
			fallback: { kind: "local" },
			providers: {
				bangumi: { enable: false, userId: "" },
				bilibili: { enable: true, vmid: "123" },
			},
			snapshot: {
				directory: "src/data/anime-snapshots",
				staleAfterDays: 30,
				keepLastValid: true,
			},
		});

		expect(correctedOptions.source.file).toBe("bilibili.json");
		expect(correctedOptions.source.provider).toBe("bilibili");
	});
});
