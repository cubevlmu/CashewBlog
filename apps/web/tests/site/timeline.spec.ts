import { expect, test } from "@playwright/test";

const TOTAL_COUNT = 5;
const MILESTONE_COUNT = 1;

test.describe("时间线页", () => {
	test.beforeEach(async ({ page }) => {
		await page.goto("/timeline/");
		await expect(page.locator(".timeline-card")).toHaveCount(TOTAL_COUNT);
	});

	test("渲染时间线事件与元数据", async ({ page }) => {
		await expect(page.locator("#swup-container")).toHaveAttribute(
			"data-current-page",
			"timeline",
		);
		await expect(page.locator(".page-header__title")).toHaveText("Timeline");
		await expect(page.locator(".timeline-section__count")).toHaveText(
			`${TOTAL_COUNT} milestones`,
		);

		const featuredItem = page.locator(".timeline-card--featured").first();
		await expect(featuredItem).toBeVisible();
		await expect(
			featuredItem.locator(".timeline-card__featured-pill"),
		).toBeVisible();
		await expect(featuredItem.locator(".timeline-card__title")).toContainText(
			"Shirone Theme M3E Major Architecture Upgrade",
		);
	});

	test("分类 chips 可筛选并再次点击恢复全部", async ({ page }) => {
		const milestoneChip = page.getByRole("button", {
			name: "Milestones",
			exact: true,
		});
		await milestoneChip.click();
		await expect(milestoneChip).toHaveAttribute("aria-pressed", "true");
		await expect(page.locator(".timeline-card")).toHaveCount(MILESTONE_COUNT);

		await milestoneChip.click();
		await expect(milestoneChip).toHaveAttribute("aria-pressed", "false");
		await expect(page.locator(".timeline-card")).toHaveCount(TOTAL_COUNT);
	});

	test("侧栏页面过滤与直接加载导航高亮正确", async ({ page }) => {
		await expect(
			page.locator('widget-layout[data-id="categories"]'),
		).toBeVisible();
		await expect(page.locator('widget-layout[data-id="tags"]')).toBeVisible();
		await expect(
			page.locator('[data-nav-key="timeline"]').first(),
		).toHaveAttribute("aria-current", "page");
	});
});

test.describe("时间线页 Swup 导航", () => {
	test.use({ viewport: { width: 1280, height: 900 } });

	test("从持久顶栏进入后同步页面、导航与侧栏状态", async ({ page }) => {
		await page.goto("/compass/", { waitUntil: "domcontentloaded" });
		await page.getByRole("button", { name: "More", exact: true }).click();
		await page.locator('a[data-nav-key="timeline"]').click();

		await expect(page).toHaveURL(/\/timeline\/$/);
		await expect(page.locator("#swup-container")).toHaveAttribute(
			"data-current-page",
			"timeline",
		);
		await expect(page.locator(".timeline-card")).toHaveCount(TOTAL_COUNT);
		await expect(page.locator('a[data-nav-key="timeline"]')).toHaveAttribute(
			"aria-current",
			"page",
		);
		await expect(
			page.locator('widget-layout[data-id="categories"]'),
		).toBeVisible();
		await expect(page.locator('widget-layout[data-id="tags"]')).toBeVisible();
	});
});
