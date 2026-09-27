import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test.describe("Markdown spoilers", () => {
	test("supports hover, focus, and native keyboard toggling", async ({
		page,
	}) => {
		await page.goto("/posts/spoilers/", { waitUntil: "domcontentloaded" });
		const spoiler = page.locator(".custom-md .m3-spoiler").first();
		await expect(spoiler).toHaveCount(1);
		await expect(spoiler).toHaveAttribute("type", "button");
		await expect(spoiler).toHaveAttribute("aria-expanded", "false");
		await expect(spoiler).toHaveAttribute("data-spoiler", "");

		await spoiler.focus();
		await expect(spoiler).toBeFocused();
		await page.keyboard.press("Enter");
		await expect(spoiler).toHaveAttribute("aria-expanded", "true");
		await page.keyboard.press("Space");
		await expect(spoiler).toHaveAttribute("aria-expanded", "false");

		const results = await new AxeBuilder({ page })
			.include(".markdown-content")
			.analyze();
		expect(results.violations).toEqual([]);
	});

	test("does not request optional network resources", async ({ page }) => {
		const requests: string[] = [];
		page.on("request", (request) => requests.push(request.url()));
		await page.goto("/posts/spoilers/", { waitUntil: "networkidle" });
		expect(requests.some((url) => url.includes("api.github.com"))).toBe(false);
	});
});
