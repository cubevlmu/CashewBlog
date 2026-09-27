import assert from "node:assert/strict";
import { test } from "node:test";

import { siteMarkdownProcessor } from "../../../../src/utils/markdown-processor.mjs";

const renderer = await siteMarkdownProcessor.createRenderer({});

async function render(markdown) {
	const { code } = await renderer.render(markdown);
	return code;
}

test("renders an ordered list as an unframed semantic step flow", async () => {
	const html = await render(`:::steps{title="Deployment Workflow"}
1. **Clone Repository**

   Clone source code from GitHub.

2. **Install Dependencies**

   Install project packages with pnpm.
:::`);

	assert.match(html, /<section class="m3-steps not-prose"/);
	assert.match(html, /aria-label="Deployment Workflow"/);
	assert.match(html, /class="m3-steps__title">Deployment Workflow<\/p>/);
	assert.match(html, /<ol class="m3-steps__list" start="1">/);
	assert.equal(html.match(/class="m3-steps__item"/g)?.length, 2);
	assert.equal(html.match(/class="m3-steps__index"/g)?.length, 2);
	assert.match(html, /class="m3-steps__index" aria-hidden="true">1<\/span>/);
	assert.match(html, /class="m3-steps__index" aria-hidden="true">2<\/span>/);
	assert.doesNotMatch(html, /m3-steps__header|m3-steps__header-icon/);
	assert.doesNotMatch(html, /<script|<iframe/);
});

test("supports directive label syntax and a custom start number", async () => {
	const html = await render(`:::steps[Quick Start]{start=4}
1. Fourth item
2. Fifth item
:::`);

	assert.match(html, /aria-label="Quick Start"/);
	assert.match(html, /<ol class="m3-steps__list" start="4">/);
	assert.match(html, />4<\/span>/);
	assert.match(html, />5<\/span>/);
});

test("preserves invalid unordered-list input as ordinary Markdown", async () => {
	const html = await render(`:::steps
- First item
- Second item
:::`);

	assert.doesNotMatch(html, /m3-steps/);
	assert.match(html, /<ul>/);
	assert.match(html, /First item/);
});

test("preserves mixed content instead of guessing step boundaries", async () => {
	const html = await render(`:::steps
Introductory paragraph.

1. First item
:::`);

	assert.doesNotMatch(html, /m3-steps/);
	assert.match(html, /Introductory paragraph/);
	assert.match(html, /<ol>/);
});

test("removes an empty steps container", async () => {
	const html = await render(":::steps\n:::");
	assert.equal(html.trim(), "");
});
