import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

test("subpath build output does not contain un-prefixed theme internal routes", () => {
	const distDir = path.resolve("dist");
	if (!fs.existsSync(distDir)) {
		return;
	}

	const htmlFiles = [];
	function walk(dir) {
		for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
			const full = path.join(dir, entry.name);
			if (entry.isDirectory()) {
				walk(full);
			} else if (entry.name.endsWith(".html")) {
				htmlFiles.push(full);
			}
		}
	}
	walk(distDir);

	// Check if this dist was built with /Shirone base
	const indexHtml = fs.readFileSync(path.join(distDir, "index.html"), "utf8");
	if (!indexHtml.includes('href="/Shirone/')) {
		return;
	}

	const brokenRoutePattern =
		/(?:href|src)="\/(?:archive|friends|moments|anime|compass|albums|about|categories|tags|projects|skills|devices|timeline)(?:\/|\?|")/g;

	const violations = [];
	for (const file of htmlFiles) {
		const content = fs.readFileSync(file, "utf8");
		const matches = content.match(brokenRoutePattern);
		if (matches) {
			violations.push({
				file: path.relative(distDir, file),
				matches,
			});
		}
	}

	assert.deepEqual(
		violations,
		[],
		`Found unexpected root-relative theme links in subpath build: ${JSON.stringify(violations, null, 2)}`,
	);
});
