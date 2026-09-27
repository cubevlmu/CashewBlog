import assert from "node:assert/strict";
import { test } from "node:test";

import {
	remarkContentAnnotations,
	rewriteContentAnnotationDefinitions,
} from "../../../../src/plugins/markdown/remark-content-annotations.mjs";
import { siteMarkdownProcessor } from "../../../../src/utils/markdown-processor.mjs";

const renderer = await siteMarkdownProcessor.createRenderer({});

async function render(markdown) {
	const { code } = await renderer.render(markdown);
	return code;
}

test("rewrites definition blocks without touching fenced examples", () => {
	const source = `\`\`\`markdown
[+demo]: stays visible
\`\`\`

[+note]:
  First paragraph.

  Second paragraph.`;
	const rewritten = rewriteContentAnnotationDefinitions(source);

	assert.match(rewritten, /\[\+demo\]: stays visible/);
	assert.match(rewritten, /:::content-note-definition\{label="note"\}/);
	assert.match(rewritten, /First paragraph\.\n\nSecond paragraph\./);
});

test("renders a defined reference as an SSR-native popover", async () => {
	const html =
		await render(`Astro uses **islands** [+islands] to add focused interactivity.

[+islands]: An **island** can include [interactive UI](https://astro.build).`);

	assert.match(html, /<strong>islands<\/strong> <button/);
	assert.match(html, /<\/button> to add focused interactivity\./);
	assert.match(html, /class="m3-content-note__trigger m3-state-layer"/);
	assert.match(html, /popovertarget="m3-content-note-1"/);
	assert.match(html, /aria-label="islands"/);
	assert.match(html, /<aside id="m3-content-note-1"/);
	assert.match(html, /popover="auto"/);
	assert.match(html, /<strong>island<\/strong>/);
	assert.match(html, /href="https:\/\/astro\.build"/);
	assert.doesNotMatch(html, /\[\+islands\]:/);
	assert.doesNotMatch(html, /<script|<iframe/);
});

test("groups repeated definitions and supports repeated references", async () => {
	const html = await render(`[+review]: First note.
[+review]: Second note.

Read [+review], then revisit [+review].`);

	assert.equal(
		html.match(/m3-content-note__trigger m3-state-layer/g)?.length,
		2,
	);
	assert.equal(
		html.match(/class="m3-content-note__popover not-prose"/g)?.length,
		2,
	);
	assert.equal(html.match(/class="m3-content-note__item"/g)?.length, 4);
	assert.match(html, /First note/);
	assert.match(html, /Second note/);
});

test("keeps undefined, invalid, link, and code references readable", async () => {
	const html = await render(`[+known]: Defined note.

Undefined [+missing], invalid [+ bad], [linked [+known]](https://example.com), and \`[+known]\`.`);

	assert.match(html, /\[\+missing\]/);
	assert.match(html, /\[\+ bad\]/);
	assert.match(html, /linked \[\+known\]/);
	assert.match(html, /<code>\[\+known\]<\/code>/);
	assert.doesNotMatch(html, /m3-content-note__trigger/);
});

test("fails clearly when registered without a Markdown parser", () => {
	assert.throws(
		() => remarkContentAnnotations.call({}),
		/requires an initialized Markdown parser/,
	);
});
