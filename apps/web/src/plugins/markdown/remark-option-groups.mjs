const TABS_OPENER =
	/^([\t ]{0,3})(:{3,})[\t ]*tabs(?:#([a-z0-9][a-z0-9._-]*))?[\t ]*$/i;
const DIRECTIVE_OPENER =
	/^[\t ]{0,3}(:{3,})[\t ]*[a-z][a-z0-9-]*(?:\[[^\]]*\])?(?:\{[^}]*\})?[\t ]*$/i;
const DIRECTIVE_CLOSER = /^[\t ]{0,3}(:{3,})[\t ]*$/;
const CODE_FENCE = /^[\t ]{0,3}(`{3,}|~{3,})/;
const ACTIVE_TAB = /^([\t ]{0,3})@tab:active(?=[\t ]|$)/;

/**
 * Normalizes the author-facing option-group syntax before remark-directive.
 * The escaped active marker prevents `:active` from becoming a text directive.
 */
export function rewriteOptionGroups(source) {
	if (typeof source !== "string" || !source.includes("tabs")) return source;

	const directiveStack = [];
	let fence = null;
	return source
		.split(/(\r?\n)/)
		.map((part) => {
			if (part === "\n" || part === "\r\n") return part;

			const fenceMatch = part.match(CODE_FENCE);
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

			const closer = part.match(DIRECTIVE_CLOSER);
			if (closer) {
				const closeLength = closer[1].length;
				for (let index = directiveStack.length - 1; index >= 0; index -= 1) {
					if (directiveStack[index].length <= closeLength) {
						directiveStack.length = index;
						break;
					}
				}
				return part;
			}

			const tabsMatch = part.match(TABS_OPENER);
			if (tabsMatch) {
				const [, indent, marker, syncKey] = tabsMatch;
				directiveStack.push({ length: marker.length, optionGroup: true });
				return `${indent}${marker}tabs${syncKey ? `{sync="${syncKey}"}` : ""}`;
			}

			const opener = part.match(DIRECTIVE_OPENER);
			if (opener) {
				directiveStack.push({
					length: opener[1].length,
					optionGroup: /[\t ]*tabs(?:\{|[\t ]|$)/i.test(
						part.slice(opener[1].length),
					),
				});
			}

			if (directiveStack.some((entry) => entry.optionGroup)) {
				return part.replace(ACTIVE_TAB, "$1@tab\\:active");
			}
			return part;
		})
		.join("");
}

export function remarkOptionGroups() {
	const parser = this.parser;
	if (typeof parser !== "function") {
		throw new TypeError(
			"remarkOptionGroups requires an initialized Markdown parser.",
		);
	}

	this.parser = function parseOptionGroups(source) {
		return parser(rewriteOptionGroups(source));
	};
}
