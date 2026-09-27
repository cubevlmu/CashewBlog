import assert from "node:assert/strict";
import { test } from "node:test";

import { siteMarkdownProcessor } from "../../../../src/utils/markdown-processor.mjs";

const renderer = await siteMarkdownProcessor.createRenderer({});

async function render(markdown) {
	return renderer.render(markdown);
}

test("renders Audio Reader as an inline speaker control without native controls", async () => {
	const result = await render(
		'Listen to :audio-reader[Pronunciation sample]{src="https://media.example.com/sample.mp3"}.',
	);

	assert.deepEqual(result.metadata.frontmatter.markdownSyntaxes, {
		schema: 1,
		syntaxes: ["audio-reader"],
	});
	assert.match(result.code, /data-audio-reader=""/);
	assert.match(result.code, /not-prose/);
	assert.match(result.code, /<audio/);
	assert.match(result.code, /data-audio-reader-media=""/);
	assert.match(result.code, /preload="none"/);
	assert.doesNotMatch(result.code, /<audio[^>]+controls/);
	assert.match(result.code, /data-audio-reader-toggle=""/);
	assert.match(result.code, /<button[^>]+type="button"/);
	assert.match(result.code, /aria-pressed="false"/);
	assert.match(result.code, /<svg[^>]+m3-audio-reader__speaker/);
	assert.match(result.code, /Pronunciation sample/);
	assert.doesNotMatch(
		result.code,
		/<a[^>]+class="m3-audio-reader__(?:source|toggle)[^>]*>/,
	);
	assert.doesNotMatch(result.code, /href=/);
});

test("rejects malformed Audio Reader directives without declaring optional assets", async () => {
	for (const markdown of [
		":audio-reader[Missing source]{}",
		':audio-reader[Unsafe source]{src="javascript:alert(1)"}',
		':audio-reader[]{src="/assets/audio/Baka.wav"}',
	]) {
		const result = await render(markdown);
		assert.doesNotMatch(result.code, /data-audio-reader/);
		assert.match(result.code, /:audio-reader/);
		assert.deepEqual(result.metadata.frontmatter.markdownSyntaxes.syntaxes, []);
	}
});

test("accepts safe local audio sources", async () => {
	const result = await render(
		':audio-reader[Local sample]{src="/assets/audio/Baka.wav"}',
	);

	assert.match(result.code, /src="\/assets\/audio\/Baka\.wav"/);
});
