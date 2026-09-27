import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import test from "node:test";

const pagesDir = fileURLToPath(new URL("../src/pages/", import.meta.url));

test("page-scope agent instructions are not an Astro route", () => {
	assert.equal(existsSync(join(pagesDir, "AGENTS.md")), false);
	assert.equal(existsSync(join(pagesDir, "_AGENTS.md")), true);
});
