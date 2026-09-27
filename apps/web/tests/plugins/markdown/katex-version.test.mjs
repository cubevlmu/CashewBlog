import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { test } from "node:test";

const require = createRequire(import.meta.url);
const requireFromRenderer = createRequire(require.resolve("rehype-katex"));

test("KaTeX page assets and rehype renderer use the same version", () => {
	assert.equal(
		require("katex/package.json").version,
		requireFromRenderer("katex/package.json").version,
		"Upgrade KaTeX CSS/fonts and rehype-katex's renderer together; their internal DOM classes must match.",
	);
});
