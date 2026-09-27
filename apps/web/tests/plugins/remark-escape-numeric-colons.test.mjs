import assert from "node:assert/strict";
import { test } from "node:test";

import {
	escapeNumericColons,
	remarkEscapeNumericColons,
} from "../../src/plugins/remark-escape-numeric-colons.mjs";
import { siteMarkdownProcessor } from "../../src/utils/markdown-processor.mjs";

// unified() 返回配置型处理器，需经 createRenderer 取得真正的渲染器（与 Astro 构建期同一条插件链）
const renderer = await siteMarkdownProcessor.createRenderer({});

test("escapes numeric ratio colons in plain text", () => {
	assert.equal(
		escapeNumericColons("photos in 3:4 and 16:9 formats"),
		"photos in 3\\:4 and 16\\:9 formats",
	);
});

test("leaves non-numeric colons untouched", () => {
	const source = "time 10:o5 and a:b and http://example.com";
	assert.equal(escapeNumericColons(source), source);
	assert.equal(escapeNumericColons("note: 5"), "note: 5");
});

test("protects inline code spans", () => {
	assert.equal(
		escapeNumericColons("use `3:4` but 16:9 outside"),
		"use `3:4` but 16\\:9 outside",
	);
});

test("protects fenced code blocks", () => {
	const source = ["```md", "keep 3:4 as is", "```", "", "text 3:4 here"].join(
		"\n",
	);
	assert.equal(
		escapeNumericColons(source),
		["```md", "keep 3:4 as is", "```", "", "text 3\\:4 here"].join("\n"),
	);

	const tildeSource = ["~~~", "4:5", "~~~", "6:7"].join("\n");
	assert.equal(
		escapeNumericColons(tildeSource),
		["~~~", "4:5", "~~~", "6\\:7"].join("\n"),
	);
});

test("ratio text survives the full Markdown pipeline", async () => {
	const { code } = await renderer.render(
		"Aspect ratios like 3:4 and 16:9 stay readable.",
	);
	assert.match(code, /3:4/);
	assert.match(code, /16:9/);
	assert.doesNotMatch(code, /\\:/);
});

test("throws a helpful error when no parser is configured", () => {
	assert.throws(
		() => remarkEscapeNumericColons.call({}),
		/Markdown 解析器配置完成/,
	);
});
