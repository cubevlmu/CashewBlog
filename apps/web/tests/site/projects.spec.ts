import { expect, test } from "@playwright/test";

const PROJECT_COUNT = 3;

test.describe("项目页", () => {
	test.beforeEach(async ({ page }) => {
		await page.goto("/projects/");
		await expect(page.locator(".project-card")).toHaveCount(PROJECT_COUNT);
	});

	test("渲染代表项目、阶段、技术栈与源码链接", async ({ page }) => {
		await expect(page.locator("#swup-container")).toHaveAttribute(
			"data-current-page",
			"projects",
		);
		await expect(page.locator(".page-header__title")).toHaveText("Projects");
		await expect(page.locator(".projects-section__count")).toHaveText(
			"3 projects",
		);

		const shirone = page.locator('[data-project="shirone"]');
		await expect(shirone.locator("h2")).toHaveText("Shirone");
		await expect(shirone.locator(".project-card__cover img")).toHaveAttribute(
			"src",
			"/assets/projects/shirone.webp",
		);
		await expect(shirone).toHaveClass(/project-card--featured/);
		await expect(shirone.locator('[data-phase="building"]')).toHaveText(
			"Building",
		);
		await expect(shirone.locator(".project-card__technologies li")).toHaveCount(
			4,
		);
		await expect(
			shirone.getByRole("link", { name: "View source" }),
		).toHaveAttribute("href", "https://github.com/LyraVoid/Shirone");

		// 无封面项目：渲染图标瓷砖形态（不渲染封面区）
		const folkpatch = page.locator('[data-project="folkpatch"]');
		await expect(folkpatch.locator(".project-card__icon")).toBeVisible();
		await expect(folkpatch.locator(".project-card__cover")).toHaveCount(0);
		await expect(folkpatch.locator('[data-phase="building"]')).toHaveText(
			"Building",
		);
		await expect(
			folkpatch.getByRole("link", { name: "View source" }),
		).toHaveAttribute("href", "https://github.com/LyraVoid/FolkPatch");

		const kernelpatch = page.locator('[data-project="kernelpatch"]');
		await expect(kernelpatch.locator(".project-card__icon")).toBeVisible();
		await expect(kernelpatch.locator(".project-card__cover")).toHaveCount(0);
		await expect(kernelpatch.locator('[data-phase="shipped"]')).toHaveText(
			"Shipped",
		);
		await expect(
			kernelpatch.getByRole("link", { name: "View source" }),
		).toHaveAttribute("href", "https://github.com/lyravoid/KernelPatch");
	});

	test("直接加载时导航高亮与侧栏页面过滤正确", async ({ page }) => {
		await expect(
			page.locator('[data-nav-key="projects"]').first(),
		).toHaveAttribute("aria-current", "page");
		await expect(
			page.locator('widget-layout[data-id="categories"]'),
		).toBeVisible();
		await expect(page.locator('widget-layout[data-id="tags"]')).toBeVisible();
	});

	test("分类筛选会同步项目数量与可见卡片（含 LoadingIndicator 过渡）", async ({
		page,
	}) => {
		await page.getByRole("button", { name: "Android", exact: true }).click();
		// 三段过渡的指示器阶段（contained LoadingIndicator 出现在内容区）
		await expect(
			page.locator(".projects-section__loading .m3-loading--contained"),
		).toBeVisible();
		await expect(page.locator(".project-card")).toHaveCount(2);
		await expect(page.locator(".projects-section__count")).toHaveText(
			"2 projects",
		);
		await expect(page.locator('[data-project="shirone"]')).toHaveCount(0);
		await expect(page.locator('[data-project="folkpatch"]')).toBeVisible();
		await expect(page.locator('[data-project="kernelpatch"]')).toBeVisible();
		await expect(page.locator(".projects-section__loading")).toHaveCount(0);

		await page.getByRole("button", { name: "Android", exact: true }).click();
		await expect(page.locator(".project-card")).toHaveCount(PROJECT_COUNT);
	});

	test("实时搜索过滤与清除（URL ?q= 同步）", async ({ page }) => {
		const searchInput = page.locator(".projects-section__search input");
		await expect(searchInput).toBeVisible();
		await searchInput.fill("Shirone");
		await expect(page.locator(".project-card")).toHaveCount(1);
		await expect(page.locator('[data-project="shirone"]')).toBeVisible();
		await expect(page).toHaveURL(/[?&]q=Shirone/);

		// 清除搜索恢复全部
		const clearBtn = page.locator(".projects-section__search-clear");
		await clearBtn.click();
		await expect(page.locator(".project-card")).toHaveCount(PROJECT_COUNT);
		await expect(page).not.toHaveURL(/q=/);
	});

	test("桌面与手机布局之间无刷新切换时重置瀑布流定位", async ({ page }) => {
		await page.setViewportSize({ width: 1280, height: 900 });
		const grid = page.locator(".projects-section__grid");
		const cards = page.locator(".project-card");

		await expect
			.poll(() =>
				grid.evaluate(
					(element) =>
						getComputedStyle(element)
							.gridTemplateColumns.split(" ")
							.filter(Boolean).length,
				),
			)
			.toBeGreaterThan(1);
		await expect
			.poll(() =>
				cards.evaluateAll((elements) =>
					elements.every(
						(element) =>
							(element as HTMLElement).style.gridColumnStart !== "" &&
							(element as HTMLElement).style.gridRowEnd !== "",
					),
				),
			)
			.toBe(true);
		await expect
			.poll(() =>
				cards.evaluateAll((elements) =>
					elements.every(
						(element) => getComputedStyle(element).gridColumnEnd === "span 1",
					),
				),
			)
			.toBe(true);

		await page.setViewportSize({ width: 390, height: 844 });

		await expect
			.poll(() =>
				grid.evaluate(
					(element) =>
						getComputedStyle(element)
							.gridTemplateColumns.split(" ")
							.filter(Boolean).length,
				),
			)
			.toBe(1);
		await expect
			.poll(() =>
				cards.evaluateAll((elements) =>
					elements.every(
						(element) =>
							(element as HTMLElement).style.gridColumnStart === "" &&
							(element as HTMLElement).style.gridRowEnd === "",
					),
				),
			)
			.toBe(true);
		await expect(cards).toHaveCount(PROJECT_COUNT);
		await expect(page).toHaveURL(/\/projects\/$/);

		await page.setViewportSize({ width: 1280, height: 900 });

		await expect
			.poll(() =>
				cards.evaluateAll((elements) =>
					elements.every(
						(element) =>
							(element as HTMLElement).style.gridColumnStart !== "" &&
							(element as HTMLElement).style.gridRowEnd !== "",
					),
				),
			)
			.toBe(true);
	});

	test("无封面卡片在桌面端将技术栈与源码操作合并为同一行", async ({ page }) => {
		await page.setViewportSize({ width: 1280, height: 900 });
		const cards = page.locator(".project-card--without-cover");

		await expect(cards).toHaveCount(PROJECT_COUNT - 1);

		const rowsMerged = await cards.evaluateAll((elements) =>
			elements.every((element) => {
				const card = element as HTMLElement;
				const technologies = card.querySelector<HTMLElement>(
					".project-card__technologies",
				);
				const actions = card.querySelector<HTMLElement>(
					".project-card__actions",
				);
				if (!technologies || !actions) return false;
				const techBox = technologies.getBoundingClientRect();
				const actionsBox = actions.getBoundingClientRect();
				// 同一行：两个区域的垂直范围必须重叠
				return (
					techBox.top < actionsBox.bottom && actionsBox.top < techBox.bottom
				);
			}),
		);

		await expect(rowsMerged).toBe(true);
	});
});

test.describe("项目页 Swup 导航", () => {
	test.use({ viewport: { width: 1280, height: 900 } });

	test("从持久顶栏进入后同步页面、导航与侧栏状态", async ({ page }) => {
		await page.goto("/skills/", { waitUntil: "domcontentloaded" });
		await page.getByRole("button", { name: "More", exact: true }).click();
		await page.locator('a[data-nav-key="projects"]').click();

		await expect(page).toHaveURL(/\/projects\/$/);
		await expect(page.locator("#swup-container")).toHaveAttribute(
			"data-current-page",
			"projects",
		);
		await expect(page.locator(".project-card")).toHaveCount(PROJECT_COUNT);
		await expect(page.locator('a[data-nav-key="projects"]')).toHaveAttribute(
			"aria-current",
			"page",
		);
		await expect(
			page.locator('widget-layout[data-id="categories"]'),
		).toBeVisible();
		await expect(page.locator('widget-layout[data-id="tags"]')).toBeVisible();
	});
});
