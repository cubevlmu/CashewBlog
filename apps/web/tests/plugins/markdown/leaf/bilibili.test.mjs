import assert from "node:assert/strict";
import { test } from "node:test";

import { siteMarkdownProcessor } from "../../../../src/utils/markdown-processor.mjs";

const renderer = await siteMarkdownProcessor.createRenderer({});

async function render(markdown) {
	return renderer.render(markdown);
}

test("renders a Bilibili facade without a provider iframe", async () => {
	const result = await render(
		'::bilibili{bvid="BV1fK4y1s7Qf" title="Example video" p=2}',
	);

	assert.deepEqual(result.metadata.frontmatter.markdownSyntaxes, {
		schema: 1,
		syntaxes: ["bilibili"],
	});
	assert.match(result.code, /data-bilibili=""/);
	assert.match(result.code, /data-bilibili-bvid="BV1fK4y1s7Qf"/);
	assert.match(result.code, /data-bilibili-part="2"/);
	assert.match(result.code, /aria-label="Example video"/);
	assert.match(
		result.code,
		/href="https:\/\/www\.bilibili\.com\/video\/BV1fK4y1s7Qf\/\?p=2"/,
	);
	assert.match(result.code, /rel="noopener noreferrer"/);
	assert.doesNotMatch(result.code, /<iframe|player\.bilibili\.com|<script/);
});

test("rejects malformed Bilibili fields without producing a facade", async () => {
	for (const markdown of [
		'::bilibili{bvid="av170001" title="Legacy ID"}',
		'::bilibili{bvid="BV1fK4y1s7Qf" title=""}',
		'::bilibili{bvid="BV1fK4y1s7Qf" title="Invalid preload" preload="eager"}',
		'::bilibili{bvid="BV1fK4y1s7Qf" title="Bad part" p=0}',
	]) {
		const result = await render(markdown);
		assert.doesNotMatch(result.code, /data-bilibili/);
		assert.match(result.code, /::bilibili/);
		assert.deepEqual(result.metadata.frontmatter.markdownSyntaxes.syntaxes, []);
	}
});

test("ignores the removed poster attribute", async () => {
	const result = await render(
		'::bilibili{bvid="BV1fK4y1s7Qf" title="Video" poster="/images/poster.webp"}',
	);
	assert.match(result.code, /data-bilibili/);
	assert.doesNotMatch(result.code, /poster|m3-bilibili__poster/);
});

test("accepts viewport-aware preloading", async () => {
	const result = await render(
		'::bilibili{bvid="BV1fK4y1s7Qf" title="Prepared video" preload="auto"}',
	);
	assert.match(result.code, /data-video-preload="auto"/);
});
