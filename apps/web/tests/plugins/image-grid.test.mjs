import assert from "node:assert/strict";
import { test } from "node:test";

import { siteMarkdownProcessor } from "../../src/utils/markdown-processor.mjs";

// unified() 返回配置型处理器，需经 createRenderer 取得真正的渲染器（与 Astro 构建期同一条插件链）
const renderer = await siteMarkdownProcessor.createRenderer({});

/**
 * 将 Markdown 处理为 HTML 字符串。
 *
 * @param {string} markdown Markdown 源码。
 * @returns {Promise<string>}
 */
async function render(markdown) {
	const { code } = await renderer.render(markdown);
	return code;
}

const THREE_IMAGES = [
	"![alpha](/images/albums/AcgExample/01.webp)",
	"![beta](/images/albums/AcgExample/02.webp)",
	"![gamma](/images/albums/AcgExample/03.webp)",
].join("\n");

test("renders a default grid with three tracks and one lightbox group", async () => {
	const html = await render(`:::grid\n${THREE_IMAGES}\n:::`);

	assert.match(html, /class="image-grid"/);
	assert.match(html, /data-columns="3"/);
	assert.match(html, /--image-grid-columns: 3;/);
	assert.match(html, /--image-grid-aspect-ratio: 16 \/ 10;/);
	assert.match(html, /--image-grid-fit: cover;/);

	const figureCount = html.match(/class="image-grid__item"/g)?.length ?? 0;
	assert.equal(figureCount, 3);

	// 同一网格共享独立分组 ID
	const groupIds = new Set(html.match(/data-fancybox="image-grid-\d+"/g) ?? []);
	assert.equal(groupIds.size, 1);

	// 零额外负担：惰性加载与异步解码
	const lazyCount = html.match(/loading="lazy"/g)?.length ?? 0;
	const asyncCount = html.match(/decoding="async"/g)?.length ?? 0;
	assert.equal(lazyCount, 3);
	assert.equal(asyncCount, 3);

	// 链接保持无样式污染标记，href 指向原图
	assert.match(html, /class="image-grid__link no-styling"/);
	assert.match(html, /href="\/images\/albums\/AcgExample\/01.webp"/);
});

test("accepts valid columns, aspect and fit attributes", async () => {
	const html = await render(
		`:::grid{columns=2 aspect="3 / 4" fit=contain}\n${THREE_IMAGES}\n:::`,
	);

	assert.match(html, /data-columns="2"/);
	assert.match(html, /--image-grid-aspect-ratio: 3 \/ 4;/);
	assert.match(html, /--image-grid-fit: contain;/);
});

test("falls back to defaults for invalid attributes", async () => {
	const html = await render(
		`:::grid{columns=9 aspect="banana" fit=fill}\n${THREE_IMAGES}\n:::`,
	);

	assert.match(html, /data-columns="3"/);
	assert.match(html, /--image-grid-aspect-ratio: 16 \/ 10;/);
	assert.match(html, /--image-grid-fit: cover;/);

	const belowRange = await render(`:::grid{columns=0}\n${THREE_IMAGES}\n:::`);
	assert.match(belowRange, /data-columns="3"/);
});

test("renders a hidden placeholder when the grid has no images", async () => {
	const html = await render(":::grid\nno images here\n:::");

	assert.match(html, /class="hidden"/);
	assert.match(html, /Invalid image grid/);
	assert.doesNotMatch(html, /image-grid__item/);
});

test("uses title over alt for captions and skips figcaption when both are empty", async () => {
	const html = await render(
		[
			":::grid",
			"![alt only](/images/albums/AcgExample/01.webp)",
			'![ignored alt](/images/albums/AcgExample/02.webp "the caption")',
			"![](/images/albums/AcgExample/03.webp)",
			":::",
		].join("\n"),
	);

	const captionCount = html.match(/class="image-grid__caption"/g)?.length ?? 0;
	assert.equal(captionCount, 2);
	assert.match(
		html,
		/<figcaption class="image-grid__caption">alt only<\/figcaption>/,
	);
	assert.match(
		html,
		/<figcaption class="image-grid__caption">the caption<\/figcaption>/,
	);
	// data-caption 与图注同源
	assert.match(html, /data-caption="the caption"/);
});

test("assigns independent lightbox groups per grid", async () => {
	const html = await render(
		[
			":::grid",
			"![one](/images/albums/AcgExample/01.webp)",
			":::",
			"",
			":::grid",
			"![two](/images/albums/AcgExample/02.webp)",
			":::",
		].join("\n"),
	);

	const groupIds = new Set(html.match(/data-fancybox="image-grid-\d+"/g) ?? []);
	assert.equal(groupIds.size, 2);
});
