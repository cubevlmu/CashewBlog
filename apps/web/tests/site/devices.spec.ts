import { expect, test } from "@playwright/test";

const DEVICE_COUNT = 5;

test.describe("设备展示页", () => {
	test.beforeEach(async ({ page }) => {
		await page.goto("/devices/");
		await expect(page.locator(".device-card")).toHaveCount(DEVICE_COUNT);
	});

	test("渲染页面标题、设备卡片与状态/规格信息", async ({ page }) => {
		await expect(page.locator("#swup-container")).toHaveAttribute(
			"data-current-page",
			"devices",
		);
		await expect(page.locator(".page-header__title")).toHaveText("My Devices");
		await expect(page.locator(".devices-section__count")).toHaveText(
			"5 devices",
		);

		const macbook = page.locator('[data-device="macbook-pro-16"]');
		await expect(macbook.locator("h2")).toHaveText('MacBook Pro 16"');
		await expect(macbook.locator(".device-card__brand")).toHaveText("Apple");
		await expect(macbook.locator('[data-status="active"]')).toContainText(
			"Active",
		);
		await expect(macbook.locator(".device-card__specs")).toContainText(
			"M3 Max / 64GB / 2TB",
		);
		await expect(macbook).toHaveClass(/device-card--featured/);
		await expect(
			macbook.getByRole("link", { name: "View details" }),
		).toHaveAttribute("href", "https://www.apple.com/macbook-pro/");

		// 无图片设备：渲染图标瓷砖形态（不渲染媒体区）
		const iphone = page.locator('[data-device="iphone-16-pro"]');
		await expect(iphone.locator(".device-card__icon")).toBeVisible();
		await expect(iphone.locator(".device-card__media")).toHaveCount(0);

		// 备用状态（backup）正确渲染
		const ipad = page.locator('[data-device="ipad-pro-11"]');
		await expect(ipad.locator('[data-status="backup"]')).toContainText(
			"Backup",
		);
	});

	test("直接加载时导航高亮与侧栏页面过滤正确", async ({ page }) => {
		await expect(
			page.locator('[data-nav-key="devices"]').first(),
		).toHaveAttribute("aria-current", "page");
		await expect(
			page.locator('widget-layout[data-id="categories"]'),
		).toBeVisible();
		await expect(page.locator('widget-layout[data-id="tags"]')).toBeVisible();
	});

	test("场景分类筛选同步剩余设备与计数（含 LoadingIndicator 过渡）", async ({
		page,
	}) => {
		await page
			.getByRole("button", { name: "Mobile & EDC", exact: true })
			.click();
		await expect(
			page.locator(".devices-section__loading .m3-loading--contained"),
		).toBeVisible();
		await expect(page.locator(".device-card")).toHaveCount(2);
		await expect(page.locator(".devices-section__count")).toHaveText(
			"2 devices",
		);
		await expect(page.locator('[data-device="iphone-16-pro"]')).toBeVisible();
		await expect(page.locator('[data-device="ipad-pro-11"]')).toBeVisible();
		await expect(page.locator('[data-device="macbook-pro-16"]')).toHaveCount(0);
		await expect(page.locator(".devices-section__loading")).toHaveCount(0);

		// 再次点击已选分类取消筛选，恢复全部
		await page
			.getByRole("button", { name: "Mobile & EDC", exact: true })
			.click();
		await expect(page.locator(".device-card")).toHaveCount(DEVICE_COUNT);
	});

	test("搜索无结果时展示空状态反馈", async ({ page }) => {
		const searchInput = page.locator(".devices-section__search input");
		await searchInput.fill("Unknown9999");
		await expect(page.locator(".device-card")).toHaveCount(0);
		await expect(page.locator(".devices-section__empty")).toContainText(
			"No devices matched your filters",
		);
	});

	test("实时搜索过滤与清除（URL ?q= 同步）", async ({ page }) => {
		const searchInput = page.locator(".devices-section__search input");
		await expect(searchInput).toBeVisible();
		await searchInput.fill("MacBook");
		await expect(page.locator(".device-card")).toHaveCount(1);
		await expect(page.locator('[data-device="macbook-pro-16"]')).toBeVisible();
		await expect(page).toHaveURL(/[?&]q=MacBook/);

		// 清除搜索恢复全部
		const clearBtn = page.locator(".devices-section__search-clear");
		await clearBtn.click();
		await expect(page.locator(".device-card")).toHaveCount(DEVICE_COUNT);
		await expect(page).not.toHaveURL(/q=/);
	});

	test("URL 参数刷新后恢复筛选状态", async ({ page }) => {
		await page
			.getByRole("button", { name: "Audio & Visual", exact: true })
			.click();
		await expect(page).toHaveURL(/[?&]category=audio/);
		await expect(page.locator(".device-card")).toHaveCount(1);
		await expect(page.locator('[data-device="sony-wh1000xm5"]')).toBeVisible();

		// 刷新后恢复同一次筛选
		await page.reload();
		await expect(page.locator(".device-card")).toHaveCount(1);
		await expect(page.locator('[data-device="sony-wh1000xm5"]')).toBeVisible();
		await expect(
			page.getByRole("button", { name: "Audio & Visual", exact: true }),
		).toHaveAttribute("aria-pressed", "true");
	});
});

test.describe("设备展示页 Swup 导航", () => {
	test.use({ viewport: { width: 1280, height: 900 } });

	test("从持久顶栏进入后同步页面、导航与侧栏状态", async ({ page }) => {
		await page.goto("/skills/", { waitUntil: "domcontentloaded" });
		await page.getByRole("button", { name: "More", exact: true }).click();
		await page.locator('a[data-nav-key="devices"]').click();

		await expect(page).toHaveURL(/\/devices\/$/);
		await expect(page.locator("#swup-container")).toHaveAttribute(
			"data-current-page",
			"devices",
		);
		await expect(page.locator(".device-card")).toHaveCount(DEVICE_COUNT);
		await expect(page.locator('a[data-nav-key="devices"]')).toHaveAttribute(
			"aria-current",
			"page",
		);
		await expect(
			page.locator('widget-layout[data-id="categories"]'),
		).toBeVisible();
		await expect(page.locator('widget-layout[data-id="tags"]')).toBeVisible();
	});
});
