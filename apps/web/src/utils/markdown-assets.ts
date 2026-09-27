import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import markdownManifest from "../plugins/markdown/manifest.json" with {
	type: "json",
};

type MarkdownStylesheetPack = {
	id: string;
	syntaxes: readonly string[];
	styles: readonly string[];
};

type MarkdownSyntaxSnapshot = {
	schema: 1;
	syntaxes: readonly string[];
};

const stylesheetPacks =
	markdownManifest.stylesheetPacks as readonly MarkdownStylesheetPack[];

/**
 * Every stylesheet a pack can reference, inlined by the bundler.
 *
 * The manifest addresses stylesheets as repository-relative paths
 * (`src/styles/markdown/trees.css`), which cannot be turned into a filesystem
 * read: rendering resolves paths against `process.cwd()`, and when the theme is
 * installed as an npm package that is the *user's* project, which has no
 * `src/styles/`. Every article using a deferred pack would fail the build.
 *
 * Globbing keeps the manifest as the single source of truth while letting Vite
 * resolve the files relative to this module, which is correct in both modes.
 *
 * `import.meta.glob` is a Vite-only API: under plain Node (the unit test
 * runner) it does not exist, so the glob is guarded and the fallback below
 * reads straight from the working tree.
 */
let stylesheetSources: Record<string, string> | undefined;
try {
	stylesheetSources = import.meta.glob("../styles/**/*.css", {
		query: "?raw",
		import: "default",
		eager: true,
	}) as Record<string, string>;
} catch {
	stylesheetSources = undefined;
}

/** `src/styles/markdown/trees.css` → the glob key `../styles/markdown/trees.css`. */
function readStylesheet(stylePath: string): string {
	if (stylesheetSources) {
		const key = `../${stylePath.replace(/^src\//, "")}`;
		const css = stylesheetSources[key];
		if (css === undefined) {
			throw new Error(
				`[markdown-assets] ${stylePath} is declared in the Markdown manifest but was not found under src/styles/.`,
			);
		}
		return css;
	}
	return readFileSync(resolve(process.cwd(), stylePath), "utf8");
}

/**
 * Resolves page-scoped stylesheets from manifest-owned syntax declarations.
 * The template marks each style block as Swup-optional so stale syntax styles
 * are removed during Swup navigation.
 */
export async function getMarkdownStylesheetAssets(
	snapshot: MarkdownSyntaxSnapshot,
): Promise<Array<{ pack: string; css: string }>> {
	const activePacks = stylesheetPacks.filter(({ syntaxes }) =>
		syntaxes.some((syntaxId) => snapshot.syntaxes.includes(syntaxId)),
	);

	return activePacks.map(({ id, styles }) => ({
		pack: id,
		css: styles.map(readStylesheet).join("\n"),
	}));
}
