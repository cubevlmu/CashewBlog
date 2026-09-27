import { expect, test } from "@playwright/test";
import { normalizeAnimeItem } from "../../src/utils/anime/normalize.ts";

test.describe("Anime Provider Fixtures 归一化校验", () => {
	test("Bangumi 数据脱敏 fixture 归一化", () => {
		const rawBangumiItem = {
			title: "葬送的芙莉莲",
			status: "watching",
			rating: 9.2,
			progress: { watched: 18, total: 28 },
			cover: "https://lain.bgm.tv/pic/cover/l/f1/8e/400000_123.jpg",
			link: "https://bgm.tv/subject/400000",
			description: "打倒魔王之后的精灵魔法使的故事。",
			year: "2023",
			studio: "MADHOUSE",
			genres: ["奇幻", "冒险", "治愈"],
			identity: {
				provider: "bangumi",
				subjectId: "400000",
			},
		};

		const item = normalizeAnimeItem(rawBangumiItem);
		expect(item).not.toBeNull();
		expect(item?.title).toBe("葬送的芙莉莲");
		expect(item?.status).toBe("watching");
		expect(item?.progress).toEqual({ watched: 18, total: 28 });
		expect(item?.link).toBe("https://bgm.tv/subject/400000");
		expect(item?.studio).toBe("MADHOUSE");
		expect(item?.identity?.provider).toBe("bangumi");
		expect(item?.identity?.subjectId).toBe("400000");
	});

	test("Bilibili 数据脱敏 fixture 归一化", () => {
		const rawBiliItem = {
			title: "轻音少女 第二季",
			status: "completed",
			rating: 9.9,
			progress: { watched: 26, total: 26 },
			cover: "https://i0.hdslb.com/bfs/bangumi/image/abc.png@220w_280h.webp",
			link: "https://www.bilibili.com/bangumi/media/md2548",
			description: "讲述了樱丘高中轻音部四位少女的音乐日常故事。",
			year: "2010",
			studio: "日本",
			genres: ["日常", "音乐", "治愈"],
			identity: {
				provider: "bilibili",
				seasonId: "389",
				sourceId: "2548",
			},
		};

		const item = normalizeAnimeItem(rawBiliItem);
		expect(item).not.toBeNull();
		expect(item?.title).toBe("轻音少女 第二季");
		expect(item?.status).toBe("completed");
		expect(item?.rating).toBe(9.9);
		expect(item?.progress).toEqual({ watched: 26, total: 26 });
		expect(item?.link).toBe("https://www.bilibili.com/bangumi/media/md2548");
		expect(item?.identity?.provider).toBe("bilibili");
		expect(item?.identity?.sourceId).toBe("2548");
	});

	test("敏感字段扫描与安全防护", () => {
		const SENSITIVE_PATTERNS = [
			/\bSESSDATA\b/i,
			/\bcookie\s*[:=]/i,
			/\bauthorization\s*[:=]/i,
			/\baccess_token\b/i,
			/\brefresh_token\b/i,
			/\bcsrf\b/i,
		];

		const cleanSnapshot = JSON.stringify({
			schemaVersion: 1,
			provider: "bilibili",
			fetchedAt: "2025-01-01T00:00:00.000Z",
			accountRef: "123456",
			items: [
				{
					title: "Bocchi the Rock!",
					status: "completed",
					rating: 9.8,
					progress: { watched: 12, total: 12 },
					year: "2022",
					genres: ["Music"],
				},
			],
		});

		for (const pattern of SENSITIVE_PATTERNS) {
			expect(pattern.test(cleanSnapshot)).toBe(false);
		}

		// 注入 SESSDATA 模拟敏感泄露
		const leakedSnapshot = JSON.stringify({
			provider: "bilibili",
			token: "SESSDATA=fake_token_123",
		});

		const detected = SENSITIVE_PATTERNS.some((p) => p.test(leakedSnapshot));
		expect(detected).toBe(true);
	});
});
