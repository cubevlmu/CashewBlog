import { pluginCollapsibleSections } from "@expressive-code/plugin-collapsible-sections";
import { pluginLineNumbers } from "@expressive-code/plugin-line-numbers";
import { defineEcConfig } from "astro-expressive-code";
import { expressiveCodeConfig } from "./src/config/expressiveCodeConfig.ts";
import { expressiveCodeShared } from "./src/config/integrationsConfig.ts";
import { pluginCustomCopyButton } from "./src/plugins/expressive-code/custom-copy-button.ts";
import { pluginLanguageBadge } from "./src/plugins/expressive-code/language-badge.ts";

/**
 * Expressive Code options live here (not inline in astro.config.mjs) so the
 * SSR runtime Markdown renderer can rebuild the exact same renderer through
 * `virtual:astro-expressive-code/*` — see src/lib/markdown/render.ts.
 */
export default defineEcConfig({
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
});
