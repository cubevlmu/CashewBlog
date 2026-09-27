import assert from "node:assert/strict";
import test from "node:test";
import { toAbsoluteUrl, url } from "../src/utils/url-utils.ts";

test("url() keeps external and data urls intact", () => {
	assert.equal(
		url("https://example.com/banner.png"),
		"https://example.com/banner.png",
	);
	assert.equal(
		url("http://example.com/banner.png"),
		"http://example.com/banner.png",
	);
	assert.equal(url("data:image/png;base64,abc"), "data:image/png;base64,abc");
	assert.equal(url("#section"), "#section");
	assert.equal(url("mailto:test@example.com"), "mailto:test@example.com");
	assert.equal(url("javascript:void(0)"), "javascript:void(0)");
});

test("url() normalizes local paths with default base", () => {
	assert.equal(url("/"), "/");
	assert.equal(url("/favicon.ico"), "/favicon.ico");
	assert.equal(url("favicon.ico"), "/favicon.ico");
	assert.equal(url("assets/images/banner.webp"), "/assets/images/banner.webp");
});

test("url() avoids duplicate base in subpath deployments", () => {
	const subpathBase = "/blog/";
	assert.equal(url("", subpathBase), "/blog/");
	assert.equal(url("/favicon.ico", subpathBase), "/blog/favicon.ico");
	assert.equal(url("favicon.ico", subpathBase), "/blog/favicon.ico");
	// If path already starts with the base path, it must not be prefixed again:
	assert.equal(url("/blog/favicon.ico", subpathBase), "/blog/favicon.ico");
	assert.equal(
		url("/blog/_astro/cover.webp", subpathBase),
		"/blog/_astro/cover.webp",
	);
});

test("toAbsoluteUrl() preserves external and data URLs", () => {
	const origin = new URL("https://example.com/posts/guide/");
	assert.equal(
		toAbsoluteUrl("https://cdn.example.com/images/cover.jpg", origin),
		"https://cdn.example.com/images/cover.jpg",
	);
	assert.equal(
		toAbsoluteUrl("http://cdn.example.com/images/cover.jpg", origin),
		"http://cdn.example.com/images/cover.jpg",
	);
	assert.equal(
		toAbsoluteUrl("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA", origin),
		"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA",
	);
});

test("toAbsoluteUrl() resolves local asset paths to absolute URLs against origin", () => {
	const origin = new URL("https://example.com/posts/guide/");
	assert.equal(
		toAbsoluteUrl("/_astro/cover.12345.webp", origin),
		"https://example.com/_astro/cover.12345.webp",
	);
	assert.equal(
		toAbsoluteUrl("assets/images/banner/desktop/1.webp", origin),
		"https://example.com/assets/images/banner/desktop/1.webp",
	);
});

test("toAbsoluteUrl() correctly handles subpath deployments without duplication", () => {
	const subpathOrigin = new URL("https://example.com/blog/posts/guide/");
	const subpathBase = "/blog/";

	// Asset already containing base
	assert.equal(
		toAbsoluteUrl("/blog/_astro/cover.webp", subpathOrigin, subpathBase),
		"https://example.com/blog/_astro/cover.webp",
	);

	// Asset without base (needs base appended)
	assert.equal(
		toAbsoluteUrl("/_astro/cover.webp", subpathOrigin, subpathBase),
		"https://example.com/blog/_astro/cover.webp",
	);

	// Relative path safely mapped to root origin with subpath base, avoiding relative slug resolution
	assert.equal(
		toAbsoluteUrl(
			"assets/images/banner/desktop/1.webp",
			subpathOrigin,
			subpathBase,
		),
		"https://example.com/blog/assets/images/banner/desktop/1.webp",
	);
});

test("toAbsoluteUrl() handles edge cases gracefully", () => {
	assert.equal(toAbsoluteUrl(""), "");
	// When no base origin is provided, returns normalized path
	assert.equal(toAbsoluteUrl("/_astro/cover.webp"), "/_astro/cover.webp");
	assert.equal(toAbsoluteUrl("assets/cover.webp"), "/assets/cover.webp");
});
