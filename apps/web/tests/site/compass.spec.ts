import { expect, test } from "@playwright/test";

/**
 * 站点罗盘页功能锁定（pages/compass.astro -> organisms/CompassSection -> molecules/CompassTile，client:only）。
 * 筛选与站内 friends/moments/anime 同一交互语言：
 * 分组 filter chips 单选（再点取消恢复全部）切换时走站内同款 LoadingIndicator 三段过渡
 * （loading → 淡出 → stagger 揭幕）；搜索即时过滤（每键收放，不闪加载器，与 MomentSection 分工一致），
 * 状态同步 URL（?group= / ?q=），刷新/分享/回退保留。
 * 分组标题与瓷砖均用站内既有语言（SectionTitle + card-bg 竖向卡），不引入额外装置。
 * 数据来自 src/data/compass.ts（本地数据源，4 组 / 11 条），
 * 覆盖「有 icon / 无 icon / 有 note / 无 note」四种形态；
 * 演示数据为纯英文（站点默认语言 en）；站点文案断言用英文，分组名来自数据。
 */

const SHELF_KEYS = ["dev", "design", "tools", "reads"];
const SHELF_NAMES: Record<string, string> = {
	dev: "Development",
	design: "Design",
	tools: "Tools",
	reads: "Reading",
};
const SHELF_TILE_COUNTS: Record<string, number> = {
	dev: 3,
	design: 3,
	tools: 2,
	reads: 3,
};
const ENTRY_COUNT = 11;

test.describe("站点罗盘页", () => {
	test.beforeEach(async ({ page }) => {
		await page.goto("/compass/");
		await expect(page.locator(".compass-tile")).toHaveCount(ENTRY_COUNT);
	});

	test("渲染分组与瓷砖（SectionTitle 标题行 / 每组条数 / 外链 / 图标三态）", async ({
		page,
	}) => {
		// 4 个分组 section，每组 tile 数与示例数据一致；标题行为站内 SectionTitle
		for (const key of SHELF_KEYS) {
			await expect(page.locator(`section[data-shelf="${key}"]`)).toHaveCount(1);
			await expect(
				page.locator(`section[data-shelf="${key}"] .compass-tile`),
			).toHaveCount(SHELF_TILE_COUNTS[key]);
			await expect(
				page.locator(`section[data-shelf="${key}"] .section-title__title`),
			).toHaveText(SHELF_NAMES[key]);
		}
		// 首 tile（GitHub）：label / 外链 / 新标签页
		const first = page.locator(".compass-tile").first();
		await expect(first.locator(".compass-tile__label")).toHaveText("GitHub");
		await expect(first.locator("a.compass-tile__link")).toHaveAttribute(
			"href",
			"https://github.com",
		);
		await expect(first.locator("a.compass-tile__link")).toHaveAttribute(
			"target",
			"_blank",
		);
		await expect(first.locator("a.compass-tile__link")).toHaveAttribute(
			"rel",
			/noopener/,
		);
		// 无 note 的 tile 副行回退域名
		await expect(
			page.locator('section[data-shelf="reads"] .compass-tile__note').first(),
		).toHaveText("news.ycombinator.com");
		// 图标形态：有 icon（Iconify）→ svg；无 icon → 首字母 tonal 块。
		// @iconify/svelte 客户端图标数据为异步加载（首次可能走远程数据源），
		// 断言放宽超时避免慢网络下误报（tile 本体与布局断言不受影响）
		await expect(first.locator(".compass-tile__icon svg")).toHaveCount(1, {
			timeout: 15_000,
		});
		const withIcon = page
			.locator('section[data-shelf="dev"] .compass-tile')
			.nth(1);
		await expect(withIcon.locator(".compass-tile__icon svg")).toHaveCount(1, {
			timeout: 15_000,
		});
		const noIcon = page
			.locator('section[data-shelf="dev"] .compass-tile')
			.nth(2);
		await expect(noIcon.locator(".compass-tile__letter")).toHaveText("S");
		await expect(noIcon.locator(".compass-tile__icon svg")).toHaveCount(0);
		// 计数行
		await expect(page.locator(".compass-section__count")).toHaveText(
			"11 sites",
		);
	});

	test("分组筛选：chips 单选过滤（三段 Loading 过渡 + 再点取消恢复，URL ?group= 同步）", async ({
		page,
	}) => {
		const designChip = page.getByRole("button", {
			name: "Design",
			exact: true,
		});
		// 选中 → 三段过渡（contained 指示器展示后淡出），收敛后只剩该组 + aria-pressed + URL 同步
		await designChip.click();
		await expect(designChip).toHaveAttribute("aria-pressed", "true");
		await expect(page).toHaveURL(/[?&]group=design/);
		await expect(
			page.locator(".compass-section__loading .m3-loading--contained"),
		).toBeVisible();
		await expect(page.locator(".compass-tile")).toHaveCount(3);
		await expect(page.locator(".compass-section__loading")).toHaveCount(0);
		await expect(page.locator('section[data-shelf="design"]')).toBeVisible();
		for (const key of ["dev", "tools", "reads"]) {
			await expect(page.locator(`section[data-shelf="${key}"]`)).toHaveCount(0);
		}
		// 再点取消 → 恢复全部 + URL 参数移除
		await designChip.click();
		await expect(designChip).toHaveAttribute("aria-pressed", "false");
		await expect(page.locator(".compass-tile")).toHaveCount(ENTRY_COUNT);
		await expect(page).not.toHaveURL(/group=/);
	});

	test("深链恢复筛选（?group=tools）与未知分组空态", async ({ page }) => {
		await page.goto("/compass/?group=tools");
		await expect(
			page.getByRole("button", { name: "Tools", exact: true }),
		).toHaveAttribute("aria-pressed", "true");
		await expect(page.locator(".compass-tile")).toHaveCount(2);
		await expect(page.locator(".compass-tile__label").first()).toHaveText(
			"Squoosh",
		);
		// 未知分组值 → 空态文案
		await page.goto("/compass/?group=nonsense");
		await expect(page.locator(".compass-section__empty")).toBeVisible();
		await expect(page.locator(".compass-section__empty")).toContainText(
			"No sites matched your search",
		);
	});

	test("搜索过滤（label / 域名命中，?q= 同步，清空恢复）", async ({ page }) => {
		// 站内顶栏搜索框同名 placeholder，限定罗盘页内搜索框
		const search = page.locator(
			'.compass-section__search input[type="search"]',
		);
		// 域名片段命中 GitHub（label 与 hostname 均含 github）
		await search.fill("github");
		await expect(page).toHaveURL(/[?&]q=github/);
		await expect(page.locator(".compass-tile")).toHaveCount(1);
		await expect(page.locator(".compass-tile__label")).toHaveText("GitHub");
		// 清空恢复全部 + URL 参数移除
		await search.fill("");
		await expect(page.locator(".compass-tile")).toHaveCount(ENTRY_COUNT);
		await expect(page).not.toHaveURL(/q=/);
		// note 命中（Regex testing & debugging → Regex101）
		await search.fill("regex");
		await expect(page.locator(".compass-tile")).toHaveCount(1);
		await expect(page.locator(".compass-tile__label")).toHaveText("Regex101");
	});

	test("空组隐藏：搜索只命中某组时其余分组不渲染", async ({ page }) => {
		await page
			.locator('.compass-section__search input[type="search"]')
			.fill("regex");
		await expect(page.locator('section[data-shelf="tools"]')).toBeVisible();
		for (const key of ["dev", "design", "reads"]) {
			await expect(page.locator(`section[data-shelf="${key}"]`)).toHaveCount(0);
		}
	});

	test("无结果空态", async ({ page }) => {
		await page
			.locator('.compass-section__search input[type="search"]')
			.fill("zzzzzz");
		await expect(page.locator(".compass-tile")).toHaveCount(0);
		await expect(page.locator(".compass-section__empty")).toBeVisible();
		await expect(page.locator(".compass-section__empty")).toContainText(
			"No sites matched your search",
		);
	});

	test("侧栏 widget 在罗盘页照常渲染（pages 过滤对齐 friends/moments/anime）", async ({
		page,
	}) => {
		await expect(
			page.locator('widget-layout[data-id="categories"]'),
		).toBeVisible();
		await expect(page.locator('widget-layout[data-id="tags"]')).toBeVisible();
	});
});
