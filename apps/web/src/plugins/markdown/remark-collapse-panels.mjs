const COLLAPSE_OPENER =
	/^([\t ]{0,3})(:{3,})[\t ]+collapse(?:[\t ]+(.*?))?[\t ]*$/i;
const FENCE_OPENER = /^[\t ]{0,3}(`{3,}|~{3,})/;
const ALLOWED_OPTIONS = new Set(["accordion", "expand"]);

/**
 * Normalizes Plume-style collapse options into remark-directive attributes.
 * Fenced examples remain literal so the syntax can document itself.
 */
export function rewriteCollapseContainers(source) {
	if (typeof source !== "string" || !source.includes("collapse")) return source;

	let fence = null;
	return source
		.split(/(\r?\n)/)
		.map((part) => {
			if (part === "\n" || part === "\r\n") return part;

			const fenceMatch = part.match(FENCE_OPENER);
			if (fenceMatch) {
				const marker = fenceMatch[1];
				if (!fence) {
					fence = { character: marker[0], length: marker.length };
				} else if (
					marker[0] === fence.character &&
					marker.length >= fence.length &&
					new RegExp(
						`^[\\t ]{0,3}${fence.character}{${fence.length},}[\\t ]*$`,
					).test(part)
				) {
					fence = null;
				}
				return part;
			}

			if (fence) return part;
			const match = part.match(COLLAPSE_OPENER);
			if (!match) return part;

			const [, indent, marker, rawOptions = ""] = match;
			const options = rawOptions
				.trim()
				.split(/[\t ]+/)
				.filter(Boolean)
				.map((option) => option.toLowerCase());
			if (options.some((option) => !ALLOWED_OPTIONS.has(option))) return part;

			const optionSet = new Set(options);
			const attributes = ["accordion", "expand"]
				.filter((option) => optionSet.has(option))
				.map((option) => `${option}=true`)
				.join(" ");
			return `${indent}${marker}collapse${attributes ? `{${attributes}}` : ""}`;
		})
		.join("");
}

export function remarkCollapsePanels() {
	const parser = this.parser;
	if (typeof parser !== "function") {
		throw new TypeError(
			"remarkCollapsePanels requires an initialized Markdown parser.",
		);
	}

	this.parser = function parseCollapsePanels(source) {
		return parser(rewriteCollapseContainers(source));
	};
}
