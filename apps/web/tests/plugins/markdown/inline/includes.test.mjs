import assert from "node:assert/strict";
import { test } from "node:test";

import {
	expandMarkdownIncludes,
	remarkIncludes,
} from "../../../../src/plugins/markdown/remark-includes.mjs";
import { siteMarkdownProcessor } from "../../../../src/utils/markdown-processor.mjs";

const renderer = await siteMarkdownProcessor.createRenderer({});

async function render(markdown) {
	const result = await renderer.render(markdown);
	return result;
}

test("expands a file region and records the include capability", async () => {
	const result = await render(
		"<!-- @include: src/content/snippets/include-example.md#public-api -->",
	);
	assert.match(
		result.code,
		/export<\/span><span[^>]*> function<\/span><span[^>]*> greet/,
	);
	assert.doesNotMatch(result.code, /@include:/);
	assert.deepEqual(result.metadata.frontmatter.markdownSyntaxes, {
		schema: 1,
		syntaxes: ["expressive-code", "include"],
	});
});

test("supports inclusive line ranges and open bounds", () => {
	const source =
		"<!-- @include: src/content/snippets/include-example.md{2-4} -->";
	const expanded = expandMarkdownIncludes(source);
	assert.equal(expanded.included, true);
	assert.match(expanded.source, /This paragraph/);
	assert.doesNotMatch(expanded.source, /Included API/);

	const open = expandMarkdownIncludes(
		"<!-- @include: src/content/snippets/include-example.md{-2} -->",
	);
	assert.match(open.source, /Included API/);
});

test("keeps fenced, invalid, missing, and recursive includes literal", () => {
	const source = [
		"```markdown",
		"<!-- @include: src/content/snippets/include-example.md -->",
		"```",
		"",
		"<!-- @include: src/content/snippets/missing.md -->",
		"<!-- @include: src/content/snippets/include-example.md{0-2} -->",
	].join("\n");
	const expanded = expandMarkdownIncludes(source);
	assert.match(expanded.source, /```markdown\n<!-- @include:/);
	assert.equal((expanded.source.match(/@include:/g) ?? []).length, 3);
});

test("requires an initialized Markdown parser", () => {
	assert.throws(
		() => remarkIncludes.call({}),
		/requires an initialized Markdown parser/,
	);
});
