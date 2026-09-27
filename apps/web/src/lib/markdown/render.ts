import {
	createMarkdownProcessor,
	type MarkdownHeading,
	type MarkdownRenderer,
	markdownConfigDefaults,
	type RehypePlugins,
	type RemarkPlugins,
} from "@astrojs/markdown-remark";
import {
	siteRehypePlugins,
	siteRemarkPlugins,
} from "@utils/markdown-processor.mjs";
import rehypeExpressiveCode from "rehype-expressive-code";
import {
	astroConfig,
	ecConfigFileOptions,
	ecIntegrationOptions,
} from "virtual:astro-expressive-code/config";
import {
	createAstroRenderer,
	mergeEcConfigOptions,
} from "virtual:astro-expressive-code/api";

/**
 * Runtime renderer for Markdown returned by the API. It runs the same
 * remark/rehype chain as `markdown.processor` in astro.config.mjs, plus
 * Expressive Code built from `ec.config.mjs` exactly like the integration does,
 * so stylesheet hashes match the assets emitted at build time.
 */

export interface RenderedMarkdown {
	html: string;
	headings: MarkdownHeading[];
	/** Data written by remark plugins (words, minutes, excerpt, feature probes). */
	frontmatter: Record<string, unknown>;
}

let rendererPromise: Promise<MarkdownRenderer> | undefined;

async function createRenderer(): Promise<MarkdownRenderer> {
	const ecConfig = mergeEcConfigOptions(ecIntegrationOptions, ecConfigFileOptions);
	const { hashedStyles: _styles, hashedScripts: _scripts, ...ecRenderer } =
		await createAstroRenderer({ astroConfig, ecConfig });
	return createMarkdownProcessor({
		...markdownConfigDefaults,
		syntaxHighlight: false,
		remarkPlugins: siteRemarkPlugins as RemarkPlugins,
		rehypePlugins: [
			...(siteRehypePlugins as RehypePlugins),
			[rehypeExpressiveCode, { ...ecConfig, customCreateRenderer: () => ecRenderer }],
		],
	});
}

export async function renderMarkdown(markdown: string): Promise<RenderedMarkdown> {
	rendererPromise ??= createRenderer();
	const renderer = await rendererPromise;
	const result = await renderer.render(markdown, { frontmatter: {} });
	return {
		html: result.code,
		headings: result.metadata.headings,
		frontmatter: result.metadata.frontmatter,
	};
}
