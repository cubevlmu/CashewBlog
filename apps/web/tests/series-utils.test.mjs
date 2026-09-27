import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	buildSeriesPostContext,
	excerptFromMarkdown,
} from "../src/utils/series-utils.ts";

const seriesPosts = [
	{ slug: "part-1", title: "第一篇", order: 1 },
	{ slug: "part-2", title: "第二篇", order: 2 },
	{ slug: "part-3", title: "第三篇", order: 3 },
];
const catalog = [
	{ title: "指南", slug: "guide", description: null, status: "completed", count: 3 },
];

describe("buildSeriesPostContext", () => {
	it("按后端顺序给出位置与相邻篇章", () => {
		const context = buildSeriesPostContext(
			{ slug: "part-2", series: { title: "指南", slug: "guide", order: 2 }, seriesPosts },
			catalog,
		);
		assert.equal(context?.index, 2);
		assert.equal(context?.total, 3);
		assert.equal(context?.status, "completed");
		assert.deepEqual(context?.prev, { slug: "part-1", title: "第一篇" });
		assert.deepEqual(context?.next, { slug: "part-3", title: "第三篇" });
	});

	it("首篇无上一篇，末篇无下一篇", () => {
		const series = { title: "指南", slug: "guide", order: 1 };
		assert.equal(buildSeriesPostContext({ slug: "part-1", series, seriesPosts }, catalog)?.prev, null);
		assert.equal(buildSeriesPostContext({ slug: "part-3", series, seriesPosts }, catalog)?.next, null);
	});

	it("不属于系列或不在系列列表中时不生成上下文", () => {
		assert.equal(buildSeriesPostContext({ slug: "x", series: null, seriesPosts: [] }, catalog), null);
		assert.equal(
			buildSeriesPostContext(
				{ slug: "orphan", series: { title: "指南", slug: "guide", order: null }, seriesPosts },
				catalog,
			),
			null,
		);
	});
});

describe("excerptFromMarkdown", () => {
	it("去掉代码块、标题与列表符号，保留正文文本", () => {
		const md = [
			"## 动机",
			"```python",
			"print('hello')",
			"```",
			"- 第一点",
			"1. 第二点",
			"> 引用一句",
		].join("\n");
		assert.equal(excerptFromMarkdown(md), "动机 第一点 第二点 引用一句");
	});

	it("链接保留锚文本，图片与 HTML 标签移除", () => {
		assert.equal(
			excerptFromMarkdown(
				"精读 [Attention Is All You Need](https://arxiv.org/abs/1706.03762) 与 ![图](x.png) <b>细节</b>",
			),
			"精读 Attention Is All You Need 与 细节",
		);
	});

	it("超长文本按词边界截断并追加省略号", () => {
		const long = "word ".repeat(40).trim();
		const out = excerptFromMarkdown(long, 50);
		assert.ok(out.length <= 51);
		assert.ok(out.endsWith("…"));
	});

	it("短文本原样返回且无省略号", () => {
		assert.equal(excerptFromMarkdown("很短的总览"), "很短的总览");
	});
});
