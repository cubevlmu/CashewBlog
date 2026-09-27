import assert from "node:assert/strict";
import { test } from "node:test";

import { rewriteCollapseContainers } from "../../../../src/plugins/markdown/remark-collapse-panels.mjs";
import { siteMarkdownProcessor } from "../../../../src/utils/markdown-processor.mjs";

const renderer = await siteMarkdownProcessor.createRenderer({});

async function render(markdown) {
	const { code } = await renderer.render(markdown);
	return code;
}

test("renders independent native disclosures with rich Markdown", async () => {
	const html = await render(`::: collapse
- **Requirements**

  Install the supported runtime.

- :+ Run \`check\`

  - Validate the manifest.
  - Validate Astro.
:::`);

	assert.match(
		html,
		/class="m3-collapse not-prose" data-collapse-mode="multiple"/,
	);
	assert.equal(
		html.match(/<details class="m3-disclosure m3-collapse__item"/g)?.length,
		2,
	);
	assert.equal(
		html.match(
			/<summary class="m3-disclosure__summary m3-collapse__summary m3-state-layer">/g,
		)?.length,
		2,
	);
	assert.equal(html.match(/<details[^>]* open>/g)?.length, 1);
	assert.match(html, /<strong>Requirements<\/strong>/);
	assert.match(html, /Run <code>check<\/code>/);
	assert.match(html, /<ul>/);
	assert.doesNotMatch(html, /:\+/);
	assert.doesNotMatch(html, /<script|<iframe/);
});

test("supports expand with an item-level closed override", async () => {
	const html = await render(`::: collapse expand
- First

  First body.

- :- Second

  Second body.

- Third

  Third body.
:::`);

	assert.equal(html.match(/<details[^>]* open>/g)?.length, 2);
	assert.match(html, /<span class="m3-collapse__title">Second<\/span>/);
});

test("supports direct attributes with one document-local accordion name", async () => {
	const html = await render(`:::collapse{accordion=true expand=true}
- First

  First body.

- :+ Second

  Second body.

- :+ Third

  Third body.
:::`);

	assert.match(html, /data-collapse-mode="accordion"/);
	assert.equal(html.match(/name="shirone-collapse-1"/g)?.length, 3);
	assert.equal(html.match(/<details[^>]* open/g)?.length, 1);
	assert.match(html, /<details[^>]* open[^>]*>[\s\S]*?Second/);
});

test("preserves invalid or mixed input as ordinary Markdown", async () => {
	const html = await render(`::: collapse
Introductory paragraph.

- Title without a separate body
:::`);

	assert.doesNotMatch(html, /m3-collapse/);
	assert.match(html, /Introductory paragraph/);
	assert.match(html, /<ul>/);
});

test("does not rewrite fenced examples or unsupported options", () => {
	const source = `\`\`\`markdown
::: collapse accordion
- Example
:::
\`\`\`

::: collapse unknown`;
	const output = rewriteCollapseContainers(source);

	assert.match(output, /::: collapse accordion/);
	assert.match(output, /::: collapse unknown/);
	assert.doesNotMatch(output, /:::collapse\{accordion=true\}/);
});
