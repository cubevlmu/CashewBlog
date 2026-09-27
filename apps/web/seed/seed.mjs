#!/usr/bin/env node
/**
 * Development seed: loads the Shirone demo posts in ./content into a running
 * CashewBlog instance through the admin API (login → categories/series → media
 * → posts → publish). Intended for local development and end-to-end testing.
 *
 *   node seed/seed.mjs --password <admin password> [--base http://127.0.0.1:8080]
 *
 * Re-running creates duplicates with suffixed slugs; seed an empty database.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { basename, dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { parse as parseYaml } from "yaml";

const { values: args } = parseArgs({
	options: {
		base: { type: "string", default: "http://127.0.0.1:8080" },
		password: { type: "string" },
	},
});
if (!args.password) {
	console.error("Usage: node seed/seed.mjs --password <admin password> [--base URL]");
	process.exit(1);
}

const contentDir = join(dirname(fileURLToPath(import.meta.url)), "content");
const base = args.base.replace(/\/+$/, "");

// --- minimal cookie-aware admin client ----------------------------------------

const cookies = new Map();

function storeCookies(response) {
	for (const header of response.headers.getSetCookie()) {
		const [pair] = header.split(";");
		const index = pair.indexOf("=");
		cookies.set(pair.slice(0, index).trim(), pair.slice(index + 1).trim());
	}
}

async function api(method, path, body) {
	const headers = {
		accept: "application/json",
		cookie: [...cookies].map(([k, v]) => `${k}=${v}`).join("; "),
	};
	const xsrf = cookies.get("XSRF-TOKEN");
	if (xsrf) headers["x-xsrf-token"] = decodeURIComponent(xsrf);
	let payload = body;
	if (body !== undefined && !(body instanceof FormData)) {
		headers["content-type"] = "application/json";
		payload = JSON.stringify(body);
	}
	const response = await fetch(`${base}/api${path}`, { method, headers, body: payload });
	storeCookies(response);
	const text = await response.text();
	if (!response.ok) throw new Error(`${method} ${path} → ${response.status}: ${text}`);
	return text ? JSON.parse(text) : undefined;
}

// --- content parsing ------------------------------------------------------------

function readMarkdown(file) {
	const source = readFileSync(file, "utf8");
	const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
	return match
		? { data: parseYaml(match[1]) ?? {}, body: source.slice(match[0].length) }
		: { data: {}, body: source };
}

function postFiles() {
	const postsDir = join(contentDir, "posts");
	return readdirSync(postsDir).flatMap((entry) => {
		const full = join(postsDir, entry);
		if (statSync(full).isDirectory()) {
			const index = join(full, "index.md");
			return existsSync(index) ? [{ file: index, slug: entry }] : [];
		}
		return extname(entry) === ".md" ? [{ file: full, slug: basename(entry, ".md") }] : [];
	});
}

// --- seeding ----------------------------------------------------------------------

const categoryIds = new Map();
async function categoryId(name) {
	if (!name) return null;
	if (!categoryIds.has(name)) {
		const created = await api("POST", "/admin/categories", { name });
		categoryIds.set(name, created.id);
	}
	return categoryIds.get(name);
}

const uploads = new Map();
async function upload(file) {
	if (!uploads.has(file)) {
		const form = new FormData();
		form.set("file", new Blob([readFileSync(file)]), basename(file));
		uploads.set(file, await api("POST", "/admin/media", form));
	}
	return uploads.get(file);
}

/** Upload co-located images referenced as `./name.ext` and rewrite them to media URLs. */
async function rewriteLocalImages(markdown, folder) {
	let result = markdown;
	for (const [, ref] of markdown.matchAll(/\]\((\.\/[^)\s"]+)/g)) {
		const file = resolve(folder, ref);
		if (!existsSync(file)) continue;
		const asset = await upload(file);
		result = result.replaceAll(`](${ref}`, `](${asset.url}`);
	}
	return result;
}

async function main() {
	await api("GET", "/admin/csrf");
	await api("POST", "/admin/login", { password: args.password });
	await api("GET", "/admin/csrf"); // tokens are bound to the signed-in identity

	const seriesIds = new Map();
	const seriesDir = join(contentDir, "series");
	for (const entry of readdirSync(seriesDir).filter((f) => f.endsWith(".md"))) {
		const { data, body } = readMarkdown(join(seriesDir, entry));
		const created = await api("POST", "/admin/series", {
			title: data.title,
			slug: basename(entry, ".md"),
			description: body.trim() || null,
			status: data.status ?? "ongoing",
			defaultCategoryId: await categoryId(data.defaultCategory),
		});
		seriesIds.set(basename(entry, ".md"), created.id);
		console.log(`series  ${data.title}`);
	}

	for (const { file, slug } of postFiles()) {
		const folder = dirname(file);
		const { data, body } = readMarkdown(file);
		const coverFile = data.image?.startsWith("./") ? resolve(folder, data.image) : null;
		const cover = coverFile && existsSync(coverFile) ? await upload(coverFile) : null;
		const post = await api("POST", "/admin/posts", {
			title: data.title,
			slug,
			description: data.description || null,
			contentMarkdown: await rewriteLocalImages(body, folder),
			coverMediaId: cover?.id ?? null,
			categoryId: await categoryId(data.category),
			seriesId: data.series ? (seriesIds.get(data.series) ?? null) : null,
			seriesOrder: data.seriesOrder ?? null,
			tags: data.tags ?? [],
			isPinned: Boolean(data.pinned),
			seoTitle: null,
			seoDescription: null,
		});
		if (!data.draft) await api("POST", `/admin/posts/${post.id}/publish`);
		console.log(`${data.draft ? "draft " : "post  "}  ${data.title}`);
	}
}

main().catch((error) => {
	console.error(error.message);
	process.exit(1);
});
