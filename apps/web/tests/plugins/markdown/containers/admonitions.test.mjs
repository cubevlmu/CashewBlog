import assert from "node:assert/strict";
import { test } from "node:test";

import { rewriteAdmonitionContainers } from "../../../../src/plugins/markdown/remark-admonitions.mjs";
import { siteMarkdownProcessor } from "../../../../src/utils/markdown-processor.mjs";

const renderer = await siteMarkdownProcessor.createRenderer({});

async function render(markdown) {
	const { code } = await renderer.render(markdown);
	return code;
}

test("renders every static variant through one semantic M3E component", async () => {
	const html = await render(`:::note
Note body.
:::

:::info
Info body.
:::

:::tip
Tip body.
:::

:::important
Important body.
:::

:::warning
Warning body.
:::

:::caution
Caution body.
:::`);

	assert.equal(html.match(/<aside /g)?.length, 6);
	for (const type of [
		"note",
		"info",
		"tip",
		"important",
		"warning",
		"caution",
	]) {
		assert.match(
			html,
			new RegExp(
				`class="admonition bdm-${type} m3-admonition not-prose" data-admonition="${type}" role="note"`,
			),
		);
	}
	assert.equal(html.match(/class="m3-admonition__body"/g)?.length, 6);
	assert.doesNotMatch(html, /<blockquote/);
});

test("supports existing labels and Plume-style spaced custom titles", async () => {
	const html = await render(`:::note[Existing **label**]
Existing body.
:::

::: warning Check the deployment target
Spaced title body.
:::`);

	assert.match(
		html,
		/class="bdm-title m3-admonition__title">Existing <strong>label<\/strong><\/span>/,
	);
	assert.match(html, />Check the deployment target<\/span>/);
	assert.equal(html.match(/m3-admonition not-prose/g)?.length, 2);
});

test("preserves every GitHub alert type in the shared renderer", async () => {
	const html = await render(`> [!NOTE]
> Note body with **emphasis**.

> [!TIP]
> Tip body.

> [!IMPORTANT]
> Important body.

> [!WARNING]
> Warning body.

> [!CAUTION]
> Caution body.`);

	for (const type of ["note", "tip", "important", "warning", "caution"]) {
		assert.match(
			html,
			new RegExp(`class="admonition bdm-${type} m3-admonition not-prose"`),
		);
	}
	assert.match(html, /Note body with <strong>emphasis<\/strong>/);
	assert.doesNotMatch(html, /<blockquote/);
});

test("renders details as a native disclosure with rich content", async () => {
	const html = await render(`::: details More context
The body contains a [link](/about/) and inline \`code\`.
:::`);

	assert.match(
		html,
		/<details class="admonition bdm-details m3-admonition not-prose" data-admonition="details">/,
	);
	assert.match(html, /<summary class="m3-admonition__header m3-state-layer">/);
	assert.match(html, /class="m3-admonition__chevron" aria-hidden="true"/);
	assert.match(html, /<a href="\/about\/">link<\/a>/);
	assert.match(html, /<code>code<\/code>/);
});

test("does not rewrite examples inside fenced code blocks", () => {
	const source = `\`\`\`markdown
::: note Example title
Body
:::
\`\`\`

::: tip Live title
Body
:::`;
	const output = rewriteAdmonitionContainers(source);

	assert.match(output, /::: note Example title/);
	assert.match(output, /:::tip\{title="Live title"\}/);
});

test("keeps empty containers valid without hidden error copy", async () => {
	const html = await render(":::info\n:::");

	assert.match(html, /class="admonition bdm-info m3-admonition not-prose"/);
	assert.doesNotMatch(html, /Invalid admonition|class="hidden"/);
});
