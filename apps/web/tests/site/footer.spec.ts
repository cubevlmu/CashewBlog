import { expect, test } from "@playwright/test";
import packageMetadata from "../../package.json" with { type: "json" };

test("footer exposes the source theme version from package metadata", async ({
	page,
}) => {
	await page.goto("/", { waitUntil: "domcontentloaded" });

	const versionLink = page
		.locator('.m3-blog-footer a[href="https://github.com/LyraVoid/Shirone"]')
		.filter({ hasText: packageMetadata.version })
		.first();

	await expect(versionLink).toHaveText(packageMetadata.version);
	const versionGroup = versionLink.locator("xpath=..");
	await expect(versionGroup.locator(":scope > span")).toHaveText("Version");
	await expect(versionGroup).toHaveCSS("gap", "6px");
});
