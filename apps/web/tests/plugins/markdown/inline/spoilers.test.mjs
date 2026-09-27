import assert from "node:assert/strict";
import { test } from "node:test";

import { siteMarkdownProcessor } from "../../../../src/utils/markdown-processor.mjs";

const renderer = await siteMarkdownProcessor.createRenderer({});

async function render(markdown) {
	const { code } = await renderer.render(markdown);
	return code;
}

test("renders spoiler directives as accessible native buttons", async () => {
	const html = await render("The answer is :spoiler[**42**].");

	assert.match(html, /<button[^>]+class="m3-spoiler m3-state-layer"/);
	assert.match(html, /data-spoiler=""/);
	assert.match(html, /aria-expanded="false"/);
	assert.match(html, /<strong>42<\/strong><\/button>/);
});

test("preserves Markdown children and avoids the legacy custom element", async () => {
	const html = await render(":spoiler[Read **the hidden detail**].");

	assert.match(html, /Read <strong>the hidden detail<\/strong>/);
	assert.doesNotMatch(html, /<spoiler/);
});
