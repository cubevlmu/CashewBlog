import { fileURLToPath } from "node:url";
import node from "@astrojs/node";
import svelte, { vitePreprocess } from "@astrojs/svelte";
import swup from "@swup/astro";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig, fontProviders } from "astro/config";
import expressiveCode from "astro-expressive-code";
import icon from "astro-icon";
import { resolvedFontOptions } from "./src/config/fontConfig.ts";
import {
	IMAGE_ENDPOINT_ROUTE,
	iconInclude,
	prebundleSpecifiers,
	svelteCompilerOptions,
	swupForwardOptions,
	swupOptions,
	TRAILING_SLASH,
	viteBuildShared,
} from "./src/config/integrationsConfig.ts";
import { siteMarkdownProcessor } from "./src/utils/markdown-processor.mjs";

const isDev = process.argv.includes("dev");
const webRoot = fileURLToPath(new URL(".", import.meta.url)).replaceAll("\\", "/").replace(/\/$/, "");
const isBuild = process.argv.includes("build");

/** Astro font declarations for the retained body/cjk/mono roles. */
function fontDeclarations() {
	if (resolvedFontOptions.mode !== "custom") return [];
	const declarations = [];
	for (const role of ["body", "cjk", "mono"]) {
		const resolved = resolvedFontOptions.roles[role];
		if (!resolved?.family) continue;
		// body + cjk compose one sans stack; Astro's generated fallbacks would
		// double-declare fallback families.
		const fallbackOpts =
			role === "mono" ? {} : { fallbacks: [], optimizedFallbacks: false };
		const local = resolved.variants.filter((v) => v.source === "local");
		if (local.length > 0) {
			declarations.push({
				provider: fontProviders.local(),
				name: resolved.family,
				cssVariable: resolved.cssVariable,
				options: {
					variants: local.map((variant) => ({
						src: [`./${variant.file}`],
						weight: variant.weight,
						style: variant.style,
						display: resolved.display,
					})),
				},
				...fallbackOpts,
			});
		} else if (resolved.variants.some((v) => v.source === "fontsource")) {
			declarations.push({
				provider: fontProviders.fontsource(),
				name: resolved.family,
				cssVariable: resolved.cssVariable,
				...fallbackOpts,
			});
		}
	}
	return declarations;
}

/**
 * Public site: Astro SSR behind the ASP.NET gateway. Site URL, theme and all
 * content are runtime data from the CashewBlog API, not build configuration.
 * Expressive Code options live in ec.config.mjs.
 */
export default defineConfig({
	root: fileURLToPath(new URL(".", import.meta.url)),
	output: "server",
	adapter: node({ mode: "standalone" }),
	trailingSlash: TRAILING_SLASH,
	image: { endpoint: { route: IMAGE_ENDPOINT_ROUTE } },
	fonts: fontDeclarations(),
	markdown: { processor: siteMarkdownProcessor },
	integrations: [
		swup({ ...swupOptions, ...swupForwardOptions }),
		icon({ include: iconInclude }),
		expressiveCode(),
		svelte({
			preprocess: [vitePreprocess({ script: true })],
			compilerOptions: svelteCompilerOptions(isDev),
		}),
	],
	vite: {
		...(process.env.CASHEWBLOG_WEB_CACHE_DIR ? { cacheDir: process.env.CASHEWBLOG_WEB_CACHE_DIR } : {}),
		root: fileURLToPath(new URL(".", import.meta.url)),
		server: {
			// Scope watching to web sources while retaining Vite's default workspace
			// file serving allowlist for pnpm dependencies outside this directory.
			watch: {
				ignored: (filePath) => {
					const normalized = filePath.replaceAll("\\", "/");
					return (
						(normalized !== webRoot && !normalized.startsWith(`${webRoot}/`)) ||
						normalized.includes("/node_modules/") ||
						normalized.includes("/System Volume Information")
					);
				},
				followSymlinks: false,
			},
		},
		resolve: {
			alias: [
				// Swap `@iconify/svelte` for the tree-shaken offline Icon wrapper.
				{
					find: /^@iconify\/svelte$/,
					replacement: fileURLToPath(
						new URL("./src/components/atoms/display/Icon.svelte", import.meta.url),
					),
				},
			],
		},
		plugins: [
			tailwindcss(),
		],
		optimizeDeps: { include: prebundleSpecifiers },
		build: viteBuildShared,
		...(isBuild
			? { esbuild: { drop: ["debugger"], pure: ["console.log", "console.debug"] } }
			: {}),
	},
});
