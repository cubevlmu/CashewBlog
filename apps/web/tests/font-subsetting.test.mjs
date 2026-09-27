import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { test } from "node:test";
import { createWoff2Subset } from "../scripts/fonts/subset-fonts.mjs";

const require = createRequire(import.meta.url);

test("creates a WOFF2 subset without a system Python dependency", async () => {
	const sourcePath = require.resolve(
		"@fontsource/outfit/files/outfit-latin-400-normal.woff2",
	);
	const sourceFont = await readFile(sourcePath);
	const subset = await createWoff2Subset(sourceFont, "Shirone 123");

	assert.equal(subset.subarray(0, 4).toString("ascii"), "wOF2");
	assert.ok(subset.length > 0);
	assert.ok(subset.length < sourceFont.length);
});
