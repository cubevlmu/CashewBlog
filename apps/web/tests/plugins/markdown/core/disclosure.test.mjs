import assert from "node:assert/strict";
import { test } from "node:test";

import { createDisclosure } from "../../../../src/plugins/markdown/core/disclosure.mjs";

test("builds a reusable native disclosure without client scripting", () => {
	const disclosure = createDisclosure({
		summary: [{ type: "text", value: "Directory" }],
		children: [{ type: "text", value: "Contents" }],
		indicator: { type: "text", value: ">" },
		open: true,
		name: "installation-options",
		className: "consumer",
	});

	assert.equal(disclosure.tagName, "details");
	assert.equal(disclosure.properties.open, true);
	assert.equal(disclosure.properties.name, "installation-options");
	assert.deepEqual(disclosure.properties.className, [
		"m3-disclosure",
		"consumer",
	]);
	assert.equal(disclosure.children[0].tagName, "summary");
	assert.equal(disclosure.children[1].tagName, "div");
});
