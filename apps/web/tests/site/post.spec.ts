import { expect, test } from "@playwright/test";

/**
 * 文章页回归：复制链接按钮。
 * 点击后把当前文章 URL 写入剪贴板，并弹出 Snackbar 提示。
 */
test.describe("Site post", () => {
	test.use({ viewport: { width: 1280, height: 900 } });

	test("Markdown headings keep tokenized spacing after direct load and Swup navigation", async ({
		page,
	}) => {
		const readHeadingSpacing = async (ids: string[]) =>
			page
				.locator(".markdown-content")
				.first()
				.evaluate((root, headingIds) => {
					const rootStyles = getComputedStyle(document.documentElement);
					return {
						sectionSpace: rootStyles.getPropertyValue("--m3e-space-4").trim(),
						compactSpace: rootStyles.getPropertyValue("--m3e-space-2").trim(),
						headings: headingIds.map((id) => {
							const heading = root.querySelector<HTMLElement>(`#${id}`);
							if (!heading) throw new Error(`Missing Markdown heading #${id}`);
							const computed = getComputedStyle(heading);
							return {
								id,
								marginTop: computed.marginTop,
								marginBottom: computed.marginBottom,
							};
						}),
					};
				}, ids);
		const expectHeadingSpacing = async (ids: string[]) => {
			const spacing = await readHeadingSpacing(ids);
			expect(spacing.headings).toEqual(
				ids.map((id, index) => ({
					id,
					marginTop: index === 0 ? "0px" : spacing.sectionSpace,
					marginBottom: spacing.compactSpace,
				})),
			);
		};
		const waitForPageReady = async () => {
			await page.waitForFunction(() =>
				getComputedStyle(document.documentElement)
					.getPropertyValue("--mc-primary")
					.trim()
					.startsWith("#"),
			);
			await page.waitForFunction(() =>
				[...document.querySelectorAll(".onload-animation")].every((element) => {
					if ((element as HTMLElement).offsetParent === null) return true;
					return getComputedStyle(element).opacity === "1";
				}),
			);
		};

		await page.route("https://api.github.com/**", (route) =>
			route.fulfill({
				status: 200,
				contentType: "application/json",
				body: JSON.stringify({
					description: "Markdown heading spacing test fixture.",
					language: "TypeScript",
					stargazers_count: 1,
					forks: 1,
					owner: {
						avatar_url:
							"data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg'/>",
					},
					license: { spdx_id: "MIT" },
				}),
			}),
		);
		await page.addInitScript(() => localStorage.setItem("theme", "light"));
		await page.goto("/posts/markdown/", { waitUntil: "domcontentloaded" });
		await waitForPageReady();
		await expectHeadingSpacing([
			"an-h1-header",
			"an-h2-header",
			"an-h3-header",
		]);

		await page.setViewportSize({ width: 390, height: 844 });
		const schemeSwitch = page.locator("#scheme-switch");
		await expect(schemeSwitch).toBeVisible({ timeout: 15_000 });
		await schemeSwitch.click();
		await expect(page.locator("html")).toHaveClass(/dark/);
		await expectHeadingSpacing([
			"an-h1-header",
			"an-h2-header",
			"an-h3-header",
		]);

		await page.waitForFunction(() => Boolean(window.swup?.hooks));
		await page.evaluate(() =>
			window.swup?.navigate("/posts/markdown-extended/"),
		);
		await expect(page).toHaveURL(/\/posts\/markdown-extended\/?$/);
		await expect(
			page.locator(".markdown-content #github-repository-cards"),
		).toBeVisible();
		await waitForPageReady();
		await expectHeadingSpacing(["github-repository-cards", "mermaid-diagrams"]);
	});

	test("guide cover is eager and responsive", async ({ page }) => {
		await page.goto("/posts/guide/", { waitUntil: "domcontentloaded" });

		const picture = page.locator("#post-cover picture");
		const image = picture.locator("img");
		await expect(picture.locator('source[type="image/avif"]')).toHaveCount(1);
		await expect(picture.locator('source[type="image/webp"]')).toHaveCount(1);
		await expect(image).toHaveAttribute("loading", "eager");
		await expect(image).toHaveAttribute("fetchpriority", "high");
		await expect(image).toHaveAttribute("srcset", /360w.*720w.*1080w.*1440w/);
	});

	test("copy link writes the post URL and shows a snackbar", async ({
		page,
		context,
	}) => {
		await context.grantPermissions(["clipboard-read", "clipboard-write"], {
			origin: "http://localhost:4321",
		});
		await page.goto("/posts/guide/", { waitUntil: "networkidle" });
		await page.waitForTimeout(600);

		await expect(page.locator("#copy-post-link")).toHaveCount(1);
		await page.click("#copy-post-link");
		await page.waitForTimeout(400);

		const clipboard = await page.evaluate(() => navigator.clipboard.readText());
		expect(clipboard).toBe("http://localhost:4321/posts/guide/");

		const snackbar = page.locator(".m3-snackbar");
		await expect(snackbar).toHaveClass(/visible/);
		await expect(page.locator(".m3-snackbar__message")).toHaveText(
			"Copied to clipboard",
		);
	});

	test("post with cover has correct og:image and twitter:image metadata", async ({
		page,
	}) => {
		await page.goto("/posts/guide/", { waitUntil: "domcontentloaded" });
		const ogImage = page.locator('meta[property="og:image"]');
		await expect(ogImage).toHaveCount(1);
		const ogImageUrl = await ogImage.getAttribute("content");
		expect(ogImageUrl).toMatch(
			/^https?:\/\/.*(\/_astro\/|\/@fs\/.*\/)cover(\..*)?\.(jpeg|jpg|webp|avif|png)(\?.*)?$/,
		);

		const twitterImage = page.locator('meta[name="twitter:image"]');
		await expect(twitterImage).toHaveCount(1);
		const twitterImageUrl = await twitterImage.getAttribute("content");
		expect(twitterImageUrl).toBe(ogImageUrl);

		const twitterCard = page.locator('meta[name="twitter:card"]');
		await expect(twitterCard).toHaveAttribute("content", "summary_large_image");
	});

	test("post without cover falls back to desktop banner image metadata", async ({
		page,
	}) => {
		await page.goto("/posts/markdown/", { waitUntil: "domcontentloaded" });
		const ogImage = page.locator('meta[property="og:image"]');
		await expect(ogImage).toHaveCount(1);
		const ogImageUrl = await ogImage.getAttribute("content");
		expect(ogImageUrl).toMatch(
			/^https?:\/\/.*(\/_astro\/|\/@fs\/.*\/)1(\..*)?\.(webp|avif|png|jpg)(\?.*)?$/,
		);

		const twitterImage = page.locator('meta[name="twitter:image"]');
		await expect(twitterImage).toHaveCount(1);
		const twitterImageUrl = await twitterImage.getAttribute("content");
		expect(twitterImageUrl).toBe(ogImageUrl);
	});
});
