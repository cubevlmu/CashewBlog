import { expect, test } from "@playwright/test";

test.describe("Feed and Subscription System", () => {
	test("serves valid RSS 2.0 XML feed", async ({ request }) => {
		const response = await request.get("/rss.xml");
		expect(response.status()).toBe(200);
		const contentType = response.headers()["content-type"];
		expect(contentType).toMatch(/xml/);

		const text = await response.text();
		expect(text).toContain('<rss version="2.0"');
		expect(text).toContain("<channel>");
		expect(text).toContain("<title>Shirone</title>");
		expect(text).toContain("<item>");
	});

	test("serves valid Atom 1.0 XML feed with correct content type", async ({
		request,
	}) => {
		const response = await request.get("/atom.xml");
		expect(response.status()).toBe(200);
		const contentType = response.headers()["content-type"];
		expect(contentType).toBe("application/atom+xml; charset=utf-8");

		const text = await response.text();
		expect(text).toContain('<?xml version="1.0" encoding="utf-8"?>');
		expect(text).toContain(
			'<feed xmlns="http://www.w3.org/2005/Atom" xml:lang="en">',
		);
		expect(text).toContain("<title>Shirone</title>");
		expect(text).toContain("<entry>");
		expect(text).toContain('<content type="html">');
	});

	test("head contains alternate discovery links for both RSS and Atom", async ({
		page,
	}) => {
		await page.goto("/", { waitUntil: "networkidle" });

		const rssLink = page.locator(
			'head link[rel="alternate"][type="application/rss+xml"]',
		);
		await expect(rssLink).toHaveAttribute("href", /rss\.xml$/);

		const atomLink = page.locator(
			'head link[rel="alternate"][type="application/atom+xml"]',
		);
		await expect(atomLink).toHaveAttribute("href", /atom\.xml$/);
	});

	test("footer contains in-site RSS and Atom links and navigates smoothly", async ({
		page,
	}) => {
		await page.goto("/", { waitUntil: "networkidle" });

		const rssFooterLink = page.locator('footer a:has-text("RSS")').first();
		const atomFooterLink = page.locator('footer a:has-text("Atom")').first();
		const sitemapFooterLink = page
			.locator('footer a:has-text("Sitemap")')
			.first();

		await expect(rssFooterLink).toBeVisible();
		await expect(atomFooterLink).toBeVisible();
		await expect(sitemapFooterLink).toBeVisible();

		await expect(rssFooterLink).toHaveAttribute("href", /\/rss\/$/);
		await expect(atomFooterLink).toHaveAttribute("href", /\/atom\/$/);
		await expect(sitemapFooterLink).toHaveAttribute(
			"href",
			/\/sitemap-index\.xml$/,
		);

		// Navigate to RSS guide page
		await rssFooterLink.first().click();
		await expect(page.locator(".feed-guide h1")).toContainText(/RSS/);
		await expect(page.locator("[data-feed-copy-btn]")).toBeVisible();
		const feedDisplay = page.locator("[data-feed-url-display]");
		await expect(feedDisplay).toHaveText(/http:\/\/localhost:4321\/rss\.xml/);
		await expect(page.locator("[data-feed-copy-btn]")).toHaveAttribute(
			"data-feed-url",
			/http:\/\/localhost:4321\/rss\.xml/,
		);
		await expect(
			page
				.locator('a:has-text("View Raw XML"), a:has-text("查看原始 XML")')
				.first(),
		).toBeVisible();

		// Navigate to Atom guide page
		const atomFooterLinkOnRss = page
			.locator('footer a:has-text("Atom")')
			.first();
		await atomFooterLinkOnRss.click();
		await expect(page.locator(".feed-guide h1")).toContainText(/Atom/);
		await expect(page.locator("[data-feed-copy-btn]")).toBeVisible();
		await expect(page.locator("[data-feed-url-display]")).toHaveText(
			/http:\/\/localhost:4321\/atom\.xml/,
		);
	});

	test("footer custom HTML injection honors zero extra DOM footprint when empty or comments only", async ({
		page,
	}) => {
		await page.goto("/", { waitUntil: "networkidle" });
		const customContainer = page.locator(".m3-blog-footer__custom");
		await expect(customContainer).toHaveCount(0);
	});
});
