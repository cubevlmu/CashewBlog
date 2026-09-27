import assert from "node:assert/strict";
import { test } from "node:test";

import { getMarkdownStylesheetAssets } from "../../src/utils/markdown-assets.ts";
import { createMarkdownSyntaxSnapshot } from "../../src/utils/markdown-syntaxes.mjs";

test("resolves only manifest-declared Markdown stylesheet packs", async () => {
	assert.deepEqual(
		await getMarkdownStylesheetAssets(createMarkdownSyntaxSnapshot()),
		[],
	);

	const assets = await getMarkdownStylesheetAssets(
		createMarkdownSyntaxSnapshot([
			"acfun",
			"audio-reader",
			"artplayer",
			"bilibili",
			"file-tree",
			"image-grid",
			"youtube",
		]),
	);

	assert.deepEqual(
		assets.map(({ pack }) => pack),
		[
			"acfun",
			"artplayer",
			"audio-reader",
			"bilibili",
			"image-grids",
			"trees",
			"youtube",
		],
	);
	assert.match(assets[0].css, /\.m3-acfun/);
	assert.match(assets[1].css, /\.m3-artplayer/);
	assert.match(assets[2].css, /\.m3-audio-reader/);
	assert.match(assets[3].css, /\.m3-bilibili/);
	assert.match(assets[4].css, /\.image-grid/);
	assert.match(assets[5].css, /\.m3-file-tree/);
	assert.match(assets[6].css, /\.m3-youtube/);
});
