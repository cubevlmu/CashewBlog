/**
 * Administrator-trusted HTML (the footer) may contain `<script>` tags. The
 * footer renders twice (desktop copy inside the Swup container, mobile copy in
 * the shell), so scripts are split out and emitted exactly once per document.
 */
const SCRIPT_TAG = /<script\b[^>]*>[\s\S]*?<\/script\s*>/gi;

export interface TrustedHtml {
	markup: string;
	scripts: string;
}

export function splitTrustedHtml(html: string): TrustedHtml {
	const scripts = html.match(SCRIPT_TAG) ?? [];
	return {
		markup: html.replace(SCRIPT_TAG, "").trim(),
		scripts: scripts.join("\n"),
	};
}
