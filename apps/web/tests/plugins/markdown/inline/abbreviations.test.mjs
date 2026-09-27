import assert from "node:assert/strict";
import { test } from "node:test";

import {
	remarkAbbreviations,
	rewriteAbbreviationDefinitions,
} from "../../../../src/plugins/markdown/remark-abbreviations.mjs";
import { siteMarkdownProcessor } from "../../../../src/utils/markdown-processor.mjs";

const renderer = await siteMarkdownProcessor.createRenderer({});

async function render(markdown) {
	const { code } = await renderer.render(markdown);
	return code;
}

test("renders defined abbreviations as anchored native popovers", async () => {
	const html = await render(`*[SSR]: Server-Side Rendering
*[LCP]: Largest Contentful Paint

SSR improves LCP.`);

	assert.match(
		html,
		/<abbr class="m3-abbreviation" data-abbreviation-expansion="Server-Side Rendering" aria-label="SSR: Server-Side Rendering" tabindex="0" aria-describedby="m3-abbr-1" style="anchor-name: --m3-abbr-1">SSR<\/abbr>/,
	);
	assert.match(
		html,
		/<span id="m3-abbr-1" class="m3-abbreviation__popover not-prose" popover="manual" role="tooltip" style="--m3-abbr-anchor: --m3-abbr-1">Server-Side Rendering<\/span>/,
	);
	assert.match(
		html,
		/<abbr class="m3-abbreviation" data-abbreviation-expansion="Largest Contentful Paint" aria-label="LCP: Largest Contentful Paint" tabindex="0" aria-describedby="m3-abbr-2" style="anchor-name: --m3-abbr-2">LCP<\/abbr>/,
	);
	assert.match(
		html,
		/<span id="m3-abbr-2" class="m3-abbreviation__popover not-prose"/,
	);
	assert.match(html, /Largest Contentful Paint/);
	assert.doesNotMatch(html, /\*\[SSR\]:/);
});

test("keeps definitions local and preserves protected Markdown content", async () => {
	const html = await render(`*[SSR]: Server-Side Rendering

SSR-first, **SSR**, \`SSR\`, and [SSR documentation](https://example.com).`);

	assert.equal(html.match(/<abbr /g)?.length, 2);
	assert.match(html, /<code>SSR<\/code>/);
	assert.match(html, /<a href="https:\/\/example.com">SSR documentation<\/a>/);
});

test("keeps invalid, duplicate, and fenced definitions literal", async () => {
	const source = `*[SSR]: Server-Side Rendering
*[SSR]: Duplicate definition
*[not valid]: Invalid term

\`\`\`markdown
*[LCP]: Largest Contentful Paint
\`\`\``;
	const html = await render(source);

	assert.match(html, /\*\[SSR\]: Duplicate definition/);
	assert.match(html, /\*\[not valid\]: Invalid term/);
	assert.match(html, /data-language="markdown"/);
	assert.match(html, /Largest Contentful Paint/);
	assert.doesNotMatch(html, /m3-abbreviation/);
});

test("does not rewrite source without valid definitions", () => {
	const source = "*[not valid]: Meaning\n\nSSR";
	assert.equal(rewriteAbbreviationDefinitions(source), source);
});

test("fails clearly when registered without a Markdown parser", () => {
	assert.throws(
		() => remarkAbbreviations.call({}),
		/requires an initialized Markdown parser/,
	);
});
