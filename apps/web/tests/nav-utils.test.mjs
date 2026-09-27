import assert from "node:assert/strict";
import test from "node:test";
import {
	navKeyForLink,
	normalizeNavPath,
	resolveNavKeys,
	resolvePageKey,
} from "../src/utils/nav-utils.ts";

const at = (href) => new URL(href, "https://example.com");

test("resolvePageKey maps system routes and filters", () => {
	assert.equal(resolvePageKey(at("/")), "home");
	assert.equal(resolvePageKey(at("/page/3/")), "home");
	assert.equal(resolvePageKey(at("/archive/")), "archive");
	assert.equal(resolvePageKey(at("/archive/?category=guides")), "categories");
	assert.equal(resolvePageKey(at("/archive/?uncategorized=true")), "categories");
	assert.equal(resolvePageKey(at("/archive/?tag=a11y")), "tags");
	assert.equal(resolvePageKey(at("/series/markdown/")), "series");
	assert.equal(resolvePageKey(at("/posts/hello/")), "");
});

test("normalizeNavPath strips query, hash and trailing slashes", () => {
	assert.equal(normalizeNavPath("/links/friends/?x=1#top"), "/links/friends");
	assert.equal(normalizeNavPath("/"), "/");
	assert.equal(normalizeNavPath("https://example.com/a"), "");
	assert.equal(normalizeNavPath("/%E5%85%B3%E4%BA%8E/"), "/关于");
});

test("custom page links highlight by path, presets by page key", () => {
	const page = navKeyForLink({ url: "/links/friends/" });
	const archive = navKeyForLink({ pageKey: "archive", url: "/archive/" });
	assert.equal(page, "/links/friends");
	assert.ok(resolveNavKeys(at("/links/friends/")).includes(page));
	assert.ok(resolveNavKeys(at("/archive/")).includes(archive));
	assert.equal(navKeyForLink({ url: "https://github.com", external: true }), "");
});
