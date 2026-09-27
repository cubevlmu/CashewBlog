import assert from "node:assert/strict";
import { test } from "node:test";

import { siteMarkdownProcessor } from "../../../../src/utils/markdown-processor.mjs";

const renderer = await siteMarkdownProcessor.createRenderer({});

async function render(markdown) {
	const { code } = await renderer.render(markdown);
	return code;
}

test("renders a nested directive tree with diff states, comments and build-time icons", async () => {
	const html = await render(`:::file-tree{title="Shirone structure"}
- src
  - components/
    - ++ Button.svelte # added component
    - -- Button.astro # removed component
  - **content.config.ts** # important file
- package.json
:::`);

	assert.match(html, /class="m3-file-tree not-prose"/);
	assert.match(html, /aria-label="Shirone structure"/);
	assert.match(html, /class="m3-file-tree__root" role="tree"/);
	assert.equal(html.match(/role="treeitem"/g)?.length, 6);
	assert.equal(html.match(/<details/g)?.length, 2);
	assert.match(
		html,
		/<details class="m3-disclosure m3-file-tree__disclosure" open>/,
	);
	assert.match(
		html,
		/<summary class="m3-disclosure__summary m3-file-tree__row">/,
	);
	assert.match(html, /m3-file-tree__node--added/);
	assert.match(html, /m3-file-tree__node--deleted/);
	assert.match(html, /m3-file-tree__node--emphasized/);
	assert.match(html, />added component<\/span>/);
	assert.match(html, /<svg[^>]+aria-hidden="true"[^>]*>/);
	assert.match(html, /m3-file-tree__icon--error/);
	assert.doesNotMatch(html, /https?:\/\//);
	assert.doesNotMatch(html, /<script|<iframe/);
});

test("renders a fenced Unicode tree through the shared component", async () => {
	const html = await render(`\`\`\`file-tree title="Build output" icon="simple"
dist/
├── _astro/
│   ├── index.css
│   └── page.js
└── package.json
\`\`\``);

	assert.match(html, /aria-label="Build output"/);
	assert.match(html, /data-icon-mode="simple"/);
	assert.equal(html.match(/role="treeitem"/g)?.length, 5);
	assert.match(html, /aria-level="3"/);
	assert.match(
		html,
		/<details class="m3-disclosure m3-file-tree__disclosure">/,
	);
	assert.match(html, />index.css<\/span>/);
	assert.doesNotMatch(html, /expressive-code/);
	assert.doesNotMatch(html, /simple-icons/);
});

test("supports Windows-style ASCII tree branches and falls back for invalid icon modes", async () => {
	const html = await render(`\`\`\`file-tree icon="unknown"
root/
+---src/
|   \\---index.ts
\`\`\``);

	assert.match(html, /data-icon-mode="colored"/);
	assert.match(html, />index.ts<\/span>/);
	assert.match(html, /m3-file-tree__icon--primary/);
});

test("treats branch-only terminal output as sibling roots", async () => {
	const html = await render(`\`\`\`file-tree
├── src/
│   └── index.ts
└── package.json
\`\`\``);

	assert.equal(html.match(/aria-level="1"/g)?.length, 2);
	assert.equal(html.match(/aria-level="2"/g)?.length, 1);
});

test("does not let a directive attribute override the list parser", async () => {
	const html = await render(`:::file-tree{syntax="code"}
- src/
  - index.ts
:::`);

	assert.equal(html.match(/role="treeitem"/g)?.length, 2);
	assert.match(html, /aria-level="2"/);
});

test("removes an empty file tree without leaving placeholder DOM", async () => {
	const html = await render(":::file-tree\n:::");
	assert.equal(html.trim(), "");
});
