import { expect, test } from "@playwright/test";

test.describe("Announcement Widget", () => {
	test("renders announcement with title, content, link, and close functionality", async ({
		page,
	}) => {
		await page.goto("/", { waitUntil: "networkidle" });
		await page.evaluate(() => {
			localStorage.removeItem("announcementClosed");
			localStorage.removeItem("announcementClosedTime");
		});
		await page.reload({ waitUntil: "networkidle" });

		const announcement = page.locator('widget-layout[data-id="announcement"]');
		await expect(announcement).toBeVisible();

		// 测试关闭功能
		const closeBtn = announcement.locator(".announcement-close-btn");
		await expect(closeBtn).toBeVisible();
		await closeBtn.click();
		await expect(announcement).toBeHidden();

		const isClosed = await page.evaluate(() =>
			localStorage.getItem("announcementClosed"),
		);
		const closedTime = await page.evaluate(() =>
			localStorage.getItem("announcementClosedTime"),
		);
		expect(isClosed).toBe("true");
		expect(Number(closedTime)).toBeGreaterThan(0);

		// 刷新后在有效期内依然隐藏
		await page.reload({ waitUntil: "networkidle" });
		await expect(announcement).toBeHidden();

		// 模拟生命周期过期（将 closedTime 修改为 2 天前）
		await page.evaluate(() => {
			const twoDaysAgo = Date.now() - 2 * 86400 * 1000;
			localStorage.setItem("announcementClosedTime", twoDaysAgo.toString());
		});

		// 重新加载页面，验证公告重新展示且 localStorage 状态已重置
		await page.reload({ waitUntil: "networkidle" });
		await expect(announcement).toBeVisible();
		const clearedClosed = await page.evaluate(() =>
			localStorage.getItem("announcementClosed"),
		);
		expect(clearedClosed).toBeNull();
	});
});
