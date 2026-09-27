import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";
import {
	normalizeDiscoveryCount,
	resolveArticleDiscoveryOptions,
} from "../../src/config/articleConfig";
import I18nKey from "../../src/i18n/i18nKey";
import { en } from "../../src/i18n/languages/en";
import { es } from "../../src/i18n/languages/es";
import { id } from "../../src/i18n/languages/id";
import { ja } from "../../src/i18n/languages/ja";
import { ko } from "../../src/i18n/languages/ko";
import { th } from "../../src/i18n/languages/th";
import { tr } from "../../src/i18n/languages/tr";
import { vi } from "../../src/i18n/languages/vi";
import { zh_CN } from "../../src/i18n/languages/zh_CN";
import { zh_TW } from "../../src/i18n/languages/zh_TW";
import {
	discoverArticles,
	selectRandomArticles,
	selectRelatedArticles,
	type DiscoverableArticle,
} from "../../src/utils/article-discovery";

const translations = [en, es, id, ja, ko, th, tr, vi, zh_CN, zh_TW];
const discoveryComponentPath = new URL(
	"../../src/components/organisms/ArticleDiscovery.astro",
	import.meta.url,
);
const discoveryKeys = [
	I18nKey.continueReading,
	I18nKey.relatedReading,
	I18nKey.relatedReadingSubtitle,
	I18nKey.randomReading,
	I18nKey.randomReadingSubtitle,
];

function article(
	slug: string,
	options: {
		tags?: string[];
		category?: string | null;
		published?: string;
	} = {},
): DiscoverableArticle {
	return {
		slug,
		data: {
			title: slug,
			published: new Date(options.published ?? "2025-01-01T00:00:00Z"),
			description: "",
			tags: options.tags ?? [],
			category: options.category ?? "",
		},
	};
}

test.describe("article discovery utilities", () => {
	test("normalizes configuration and honors every switch", () => {
		expect(normalizeDiscoveryCount(-2)).toBe(0);
		expect(normalizeDiscoveryCount(2.9)).toBe(2);
		expect(normalizeDiscoveryCount(99)).toBe(6);
		expect(normalizeDiscoveryCount(Number.NaN)).toBe(0);

		expect(
			resolveArticleDiscoveryOptions({
				discovery: {
					enable: false,
					related: { enable: true, count: 3 },
					random: { enable: true, count: 2 },
				},
			}),
		).toBeNull();
		expect(
			resolveArticleDiscoveryOptions({
				discovery: {
					enable: true,
					related: { enable: false, count: 3 },
					random: { enable: true, count: 2.8 },
				},
			}),
		).toEqual({ relatedCount: 0, randomCount: 2 });
		expect(
			resolveArticleDiscoveryOptions({
				discovery: {
					enable: true,
					related: { enable: true, count: 4 },
					random: { enable: false, count: 2 },
				},
			}),
		).toEqual({ relatedCount: 4, randomCount: 0 });
		expect(
			resolveArticleDiscoveryOptions({
				discovery: {
					enable: true,
					related: { enable: false, count: 3 },
					random: { enable: false, count: 2 },
				},
			}),
		).toBeNull();
		expect(
			resolveArticleDiscoveryOptions({
				discovery: {
					enable: true,
					related: { enable: true, count: 0 },
					random: { enable: true, count: 0 },
				},
			}),
		).toBeNull();
	});

	test("requires semantic evidence and normalizes tags and categories", () => {
		const current = article("current", {
			tags: [" Astro ", "M3E"],
			category: " Guides ",
		});
		const candidates = [
			current,
			article("tag-match", { tags: ["astro"] }),
			article("category-match", { category: "guides" }),
			article("unrelated", { tags: ["Cooking"], category: "Life" }),
		];

		expect(
			selectRelatedArticles(current, candidates, 5).map((item) => item.slug),
		).toEqual(["tag-match", "category-match"]);
	});

	test("ranks rarer shared tags higher and resolves ties deterministically", () => {
		const current = article("current", { tags: ["common", "rare"] });
		const rare = article("rare-match", {
			tags: ["rare"],
			published: "2024-01-01T00:00:00Z",
		});
		const common = article("common-match", {
			tags: ["common"],
			published: "2025-01-01T00:00:00Z",
		});
		const commonSecond = article("common-second", { tags: ["common"] });

		const result = selectRelatedArticles(
			current,
			[current, common, rare, commonSecond],
			3,
		);
		expect(result[0].slug).toBe("rare-match");
		expect(result.map((item) => item.slug)).toEqual(
			selectRelatedArticles(
				current,
				[commonSecond, rare, current, common],
				3,
			).map((item) => item.slug),
		);
	});

	test("keeps random results stable, unique, and separate from related results", () => {
		const current = article("current", { tags: ["shared"] });
		const candidates = [
			current,
			article("related", { tags: ["shared"] }),
			article("alpha"),
			article("beta"),
			article("gamma"),
			article("beta"),
		];
		const first = discoverArticles(current, candidates, 1, 10);
		const second = discoverArticles(current, [...candidates].reverse(), 1, 10);

		expect(first.related.map((item) => item.slug)).toEqual(["related"]);
		expect(first.random.map((item) => item.slug)).toEqual(
			second.random.map((item) => item.slug),
		);
		expect(new Set(first.random.map((item) => item.slug)).size).toBe(3);
		expect(first.random.map((item) => item.slug)).not.toContain("current");
		expect(first.random.map((item) => item.slug)).not.toContain("related");
		expect(selectRandomArticles(current, candidates, 0)).toEqual([]);
	});

	test("keeps discovery copy complete in every locale", () => {
		for (const translation of translations) {
			for (const key of discoveryKeys) {
				expect(translation[key].trim()).not.toBe("");
			}
		}
	});

	test("keeps single-lane and empty-result rendering branches in the production component", async () => {
		const source = await readFile(discoveryComponentPath, "utf8");
		expect(source).toContain("{(hasRelated || hasRandom) && (");
		expect(source).toContain(
			'hasRelated && hasRandom ? "" : " article-discovery__lanes--single"',
		);
		expect(source).toContain("{hasRelated && (");
		expect(source).toContain("{hasRandom && (");
	});
});

test.describe("article discovery page", () => {
	test("renders unique SSR links after chronological navigation", async ({
		request,
	}) => {
		const response = await request.get("/posts/guide/");
		expect(response.ok()).toBe(true);
		const html = await response.text();
		expect(html).toContain("data-article-discovery");
		expect(html).toContain("data-discovery-related");
		expect(html).toContain("data-discovery-random");
		expect(html.indexOf("data-article-discovery")).toBeGreaterThan(
			html.indexOf("license-container"),
		);
	});

	test("excludes the current post and duplicates across both lanes", async ({
		page,
	}) => {
		await page.goto("/posts/guide/", { waitUntil: "domcontentloaded" });
		const links = page.locator(
			"[data-article-discovery] .article-discovery-item__link",
		);
		await expect(links.first()).toBeVisible();
		const linkState = await links.evaluateAll((elements) => ({
			hrefs: elements.map((element) => element.getAttribute("href")),
			useStateLayer: elements.every((element) =>
				element.classList.contains("m3-state-layer"),
			),
		}));
		expect(linkState.hrefs).not.toContain("/posts/guide/");
		expect(new Set(linkState.hrefs).size).toBe(linkState.hrefs.length);
		expect(linkState.useStateLayer).toBe(true);
	});

	test("sits inside the article container and does not overflow on a narrow viewport", async ({
		page,
	}) => {
		await page.setViewportSize({ width: 390, height: 844 });
		await page.goto("/posts/guide/", { waitUntil: "domcontentloaded" });
		const discovery = page.locator("[data-article-discovery]");
		await expect(discovery).toBeVisible();
		const layout = await discovery.evaluate((element) => ({
			insidePost: Boolean(
				document.querySelector("#post-container")?.contains(element),
			),
			overflows: element.scrollWidth > element.clientWidth,
		}));
		expect(layout).toEqual({ insidePost: true, overflows: false });
	});

	test("expands the production single-lane modifier across the desktop grid", async ({
		page,
	}) => {
		await page.setViewportSize({ width: 1024, height: 768 });
		await page.goto("/posts/guide/", { waitUntil: "domcontentloaded" });
		const lanes = page.locator(".article-discovery__lanes");
		await expect(lanes).toBeVisible();
		const modifier = "article-discovery__lanes--single";
		const componentSource = await readFile(discoveryComponentPath, "utf8");
		expect(componentSource).toContain(modifier);
		const layout = await lanes.evaluate((element) => {
			element.classList.add("article-discovery__lanes--single");
			element.querySelector("[data-discovery-random]")?.remove();
			const gridWidth = element.getBoundingClientRect().width;
			const laneWidth =
				element.firstElementChild?.getBoundingClientRect().width ?? 0;
			return {
				hasModifier: element.classList.contains(
					"article-discovery__lanes--single",
				),
				columnCount:
					getComputedStyle(element).gridTemplateColumns.split(" ").length,
				widthDifference: Math.abs(gridWidth - laneWidth),
			};
		});
		expect(layout.hasModifier).toBe(true);
		expect(layout.columnCount).toBe(1);
		expect(layout.widthDifference).toBeLessThan(1);
	});

	test("replaces discovery content after Swup article navigation", async ({
		page,
	}) => {
		await page.goto("/posts/guide/", { waitUntil: "domcontentloaded" });
		const firstLink = page
			.locator("[data-article-discovery] .article-discovery-item__link")
			.first();
		const target = await firstLink.getAttribute("href");
		expect(target).toBeTruthy();
		await firstLink.click();
		await expect(page).toHaveURL(
			new RegExp(`${target?.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`),
		);
		await expect(page.locator("[data-article-discovery]")).toBeVisible();
		const hrefs = await page
			.locator("[data-article-discovery] .article-discovery-item__link")
			.evaluateAll((elements) =>
				elements.map((element) => element.getAttribute("href")),
			);
		expect(hrefs).not.toContain(target);
	});
});
