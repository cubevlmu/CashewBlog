import assert from "node:assert/strict";
import test from "node:test";
import { splitTrustedHtml } from "../src/lib/site/trusted-html.ts";

test("splits footer scripts from markup", () => {
	const { markup, scripts } = splitTrustedHtml(
		'<p>备案号</p>\n<script async src="https://example.com/a.js"></script><SCRIPT>track()</SCRIPT >',
	);
	assert.equal(markup, "<p>备案号</p>");
	assert.equal(
		scripts,
		'<script async src="https://example.com/a.js"></script>\n<SCRIPT>track()</SCRIPT >',
	);
});

test("markup without scripts is unchanged", () => {
	assert.deepEqual(splitTrustedHtml(" <b>hi</b> "), { markup: "<b>hi</b>", scripts: "" });
});
