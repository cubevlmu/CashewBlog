import assert from "node:assert/strict";
import { test } from "node:test";

import {
	remarkMarker,
	rewriteMarkerSyntax,
} from "../../../../src/plugins/markdown/remark-marker.mjs";
import { siteMarkdownProcessor } from "../../../../src/utils/markdown-processor.mjs";

const renderer = await siteMarkdownProcessor.createRenderer({});

async function render(markdown) {
	const { code } = await renderer.render(markdown);
	return code;
}

test("renders default and semantic markers as native mark elements", async () => {
	const html = await render(`==Primary==

==Secondary=={.secondary}

==Tertiary=={.tertiary}

==Error=={.error}

==Tip=={.tip}`);

	for (const variant of ["primary", "secondary", "tertiary", "error", "tip"]) {
		assert.match(
			html,
			new RegExp(
				`<mark class="m3-marker m3-marker--${variant}" data-marker="${variant}">`,
			),
		);
	}
	assert.equal(html.match(/<mark /g)?.length, 5);
});

test("preserves inline Markdown inside marker content", async () => {
	const html = await render("==Build with **semantic tokens**=={.primary}");

	assert.match(
		html,
		/<mark class="m3-marker m3-marker--primary" data-marker="primary">Build with <strong>semantic tokens<\/strong><\/mark>/,
	);
});

test("keeps code and invalid marker forms literal", async () => {
	const html = await render(`\`==inline literal==\`

\`\`\`markdown
==fenced literal=={.error}
\`\`\`

==unfinished

==Unsupported=={.unknown}`);

	assert.match(html, /<code>==inline literal==<\/code>/);
	assert.match(html, /==fenced literal==\{\.error\}/);
	assert.match(html, /==unfinished/);
	assert.match(html, /==Unsupported==\{\.unknown\}/);
	assert.doesNotMatch(html, /m3-marker--error/);
});

test("does not rewrite escaped and triple-equals text", () => {
	const source = String.raw`\==escaped==
===not a marker===
==Live=={.tip}`;
	const output = rewriteMarkerSyntax(source);

	assert.match(output, /\\==escaped==/);
	assert.match(output, /===not a marker===/);
	assert.match(output, /:m3-mark\[Live\]\{variant="tip"\}/);
});

test("fails clearly when registered without a Markdown parser", () => {
	assert.throws(
		() => remarkMarker.call({}),
		/requires an initialized Markdown parser/,
	);
});
