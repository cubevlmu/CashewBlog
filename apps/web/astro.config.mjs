import { pluginCollapsibleSections } from "@expressive-code/plugin-collapsible-sections";
import { pluginLineNumbers } from "@expressive-code/plugin-line-numbers";
import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";
import svelte, { vitePreprocess } from "@astrojs/svelte";
import swup from "@swup/astro";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath } from "node:url";
import { defineConfig, fontProviders } from "astro/config";
import expressiveCode from "astro-expressive-code";
import icon from "astro-icon";
import { expressiveCodeConfig } from "./src/config/expressiveCodeConfig.ts";
import { resolvedFontOptions } from "./src/config/fontConfig.ts";
import {
	expressiveCodeShared,
	IMAGE_ENDPOINT_ROUTE,
	iconInclude,
	mdxOptions,
	prebundleSpecifiers,
	svelteCompilerOptions,
	swupForwardOptions,
	swupOptions,
	TRAILING_SLASH,
	viteBuildShared,
} from "./src/config/integrationsConfig.ts";
import { siteConfig } from "./src/config/siteConfig.ts";
import { pluginCustomCopyButton } from "./src/plugins/expressive-code/custom-copy-button.ts";
import { pluginLanguageBadge } from "./src/plugins/expressive-code/language-badge.ts";
import { siteMarkdownProcessor } from "./src/utils/markdown-processor.mjs";

const isDev = process.argv.includes("dev");
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

export default defineConfig({
	site: siteConfig.site,
	trailingSlash: TRAILING_SLASH,
	image: { endpoint: { route: IMAGE_ENDPOINT_ROUTE } },
	fonts: fontDeclarations(),
	markdown: { processor: siteMarkdownProcessor },
	integrations: [
		swup({ ...swupOptions, ...swupForwardOptions }),
		icon({ include: iconInclude }),
		expressiveCode({
			themes: [
				expressiveCodeConfig.lightTheme ?? expressiveCodeConfig.theme,
				expressiveCodeConfig.darkTheme ?? expressiveCodeConfig.theme,
			],
			plugins: [
				pluginCollapsibleSections(),
				pluginLineNumbers(),
				pluginLanguageBadge(),
				pluginCustomCopyButton(),
			],
			...expressiveCodeShared,
		}),
		svelte({
			preprocess: [vitePreprocess({ script: true })],
			compilerOptions: svelteCompilerOptions(isDev),
		}),
		sitemap(),
		mdx(mdxOptions),
	],
	vite: {
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
		plugins: [tailwindcss()],
		optimizeDeps: { include: prebundleSpecifiers },
		build: viteBuildShared,
		...(isBuild
			? { esbuild: { drop: ["debugger"], pure: ["console.log", "console.debug"] } }
			: {}),
	},
});
