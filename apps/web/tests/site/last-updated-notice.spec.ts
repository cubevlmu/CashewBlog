import { expect, test } from "@playwright/test";
import { resolveLastUpdatedNoticeOptions } from "../../src/config/articleConfig";
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
	differenceInUtcCalendarDays,
	normalizeMinimumAgeDays,
	resolveLastUpdatedNoticeState,
} from "../../src/utils/date-utils";

const translations = [en, es, id, ja, ko, th, tr, vi, zh_CN, zh_TW];
const NOTICE = "[data-last-updated-notice]";

test.describe("last updated date utilities", () => {
	test("calculates UTC calendar days independently of time of day", () => {
		expect(
			differenceInUtcCalendarDays(
				new Date("2025-01-01T23:59:59Z"),
				new Date("2025-01-02T00:00:01Z"),
			),
		).toBe(1);
	});

	test("shows on the threshold boundary and hides future dates", () => {
		const reference = new Date("2025-04-01T12:00:00Z");
		expect(
			resolveLastUpdatedNoticeState(
				new Date("2025-01-01T00:00:00Z"),
				90,
				reference,
			),
		).toEqual({ days: 90, visible: true });
		expect(
			resolveLastUpdatedNoticeState(
				new Date("2025-01-02T00:00:00Z"),
				90,
				reference,
			),
		).toEqual({ days: 89, visible: false });
		expect(
			resolveLastUpdatedNoticeState(
				new Date("2025-04-02T00:00:00Z"),
				0,
				reference,
			),
		).toEqual({ days: 0, visible: false });
	});

	test("normalizes invalid thresholds", () => {
		expect(normalizeMinimumAgeDays(-4)).toBe(0);
		expect(normalizeMinimumAgeDays(12.9)).toBe(12);
		expect(normalizeMinimumAgeDays(Number.NaN)).toBe(0);
	});

	test("keeps localized copy complete in every locale", () => {
		for (const translation of translations) {
			const message = translation[I18nKey.lastUpdatedNotice];
			expect(message.match(/\{date\}/g)).toHaveLength(1);
			expect(message.match(/\{days\}/g)).toHaveLength(1);
			expect(translation[I18nKey.lastUpdatedWarning].trim()).not.toBe("");
		}
	});
});

test.describe("article last updated notice", () => {
	test("honors the global enable switch", () => {
		expect(
			resolveLastUpdatedNoticeOptions({
				lastUpdated: { enable: false, minimumAgeDays: 90 },
			}),
		).toBeNull();
		expect(
			resolveLastUpdatedNoticeOptions({
				lastUpdated: { enable: true, minimumAgeDays: 30 },
			}),
		).toEqual({ enable: true, minimumAgeDays: 30 });
	});

	test("is present in SSR with semantic date and modified metadata", async ({
		request,
	}) => {
		const response = await request.get("/posts/markdown-extended/");
		expect(response.ok()).toBe(true);
		const html = await response.text();
		const noticeHtml = html.match(
			/<div[^>]*data-last-updated-notice[\s\S]*?<\/div>/,
		)?.[0];
		expect(noticeHtml).toBeDefined();
		expect(noticeHtml).toContain('role="note"');
		expect(noticeHtml).toContain(
			'data-last-updated-date="2024-11-29T00:00:00.000Z"',
		);
		expect(noticeHtml).toContain('<time datetime="2024-11-29T00:00:00.000Z"');
		expect(html).toContain('class="last-updated-notice__warning"');
		expect(html).toContain("Some content may be outdated");
		expect(html).toContain('"dateModified":"2024-11-29"');
		expect(noticeHtml).not.toContain("{date}");
		expect(noticeHtml).not.toContain("{days}");
	});

	test("uses updated when present and published as fallback", async ({
		page,
	}) => {
		await page.clock.setFixedTime(new Date("2025-04-01T12:00:00Z"));

		await page.goto("/posts/markdown-extended/", {
			waitUntil: "domcontentloaded",
		});
		const updatedNotice = page.locator(NOTICE);
		await expect(updatedNotice).toBeVisible();
		await expect(updatedNotice).toContainText("2024-11-29");
		await expect(updatedNotice.locator("[data-last-updated-days]")).toHaveText(
			"123",
		);

		await page.goto("/posts/guide/", { waitUntil: "domcontentloaded" });
		const publishedFallback = page.locator(NOTICE);
		await expect(publishedFallback).toBeVisible();
		await expect(publishedFallback).toContainText("2024-04-01");
	});

	test("recalculates visibility after Swup navigation", async ({ page }) => {
		await page.clock.setFixedTime(new Date("2025-01-01T12:00:00Z"));
		await page.goto("/", { waitUntil: "domcontentloaded" });
		await page.locator('a[href="/posts/guide/"]').first().click();
		await expect(page).toHaveURL(/\/posts\/guide\/$/);
		await expect(page.locator(NOTICE)).toBeVisible();
		await expect(page.locator("[data-last-updated-days]")).toHaveText("275");
	});

	test("sits between the article card and navigation without narrow overflow", async ({
		page,
	}) => {
		await page.setViewportSize({ width: 390, height: 844 });
		await page.clock.setFixedTime(new Date("2025-01-01T12:00:00Z"));
		await page.goto("/posts/guide/", { waitUntil: "domcontentloaded" });
		const notice = page.locator(NOTICE);
		await expect(notice).toBeVisible();
		const layout = await notice.evaluate((element) => {
			const article = document.querySelector("#post-container");
			const navigation = document.querySelector(".post-nav");
			return {
				afterArticle: Boolean(
					article &&
						article.compareDocumentPosition(element) &
							Node.DOCUMENT_POSITION_FOLLOWING,
				),
				beforeNavigation: Boolean(
					navigation &&
						element.compareDocumentPosition(navigation) &
							Node.DOCUMENT_POSITION_FOLLOWING,
				),
				overflows: element.scrollWidth > element.clientWidth,
			};
		});
		expect(layout).toEqual({
			afterArticle: true,
			beforeNavigation: true,
			overflows: false,
		});
	});
});
