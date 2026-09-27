import assert from "node:assert/strict";
import { test } from "node:test";

import { siteMarkdownProcessor } from "../../src/utils/markdown-processor.mjs";

const renderer = await siteMarkdownProcessor.createRenderer({});

test("wraps Markdown tables in a keyboard-focusable scroll container", async () => {
	const { code } = await renderer.render(
		["| Field | Description |", "| --- | --- |", "| title | Main title |"].join(
			"\n",
		),
	);

	assert.match(
		code,
		/<div class="markdown-table-scroll" tabindex="0">\s*<table>/,
	);
	assert.match(code, /<th>Field<\/th>/);
	assert.match(code, /<td>Main title<\/td>/);
});
