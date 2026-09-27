const DEFINITION_NAME = "abbreviation-definition";
const LITERAL_DEFINITION_NAME = "abbreviation-literal-definition";
const DEFINITION_PATTERN = /^\*\[([^\]\s"{}=]+)\]:[ \t]+(.+)$/u;
const FENCE_PATTERN = /^ {0,3}(`{3,}|~{3,})/;
const TERM_PATTERN = /^[\p{L}\p{N}][\p{L}\p{N}._+-]{0,47}$/u;
const SKIPPED_PARENT_TYPES = new Set([
	"abbreviationLiteral",
	"code",
	"definition",
	"html",
	"image",
	"imageReference",
	"inlineCode",
	"link",
	"linkReference",
]);

function escapeAttribute(value) {
	return value.replaceAll("&", "&amp;").replaceAll('"', "&quot;");
}

function escapePattern(value) {
	return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isValidTerm(value) {
	return TERM_PATTERN.test(value);
}

export function rewriteAbbreviationDefinitions(source) {
	const lines = String(source).split(/\r?\n/);
	const output = [];
	const definitions = new Set();
	let fenceMarker = "";

	for (const line of lines) {
		const fence = line.match(FENCE_PATTERN)?.[1] ?? "";
		if (fenceMarker) {
			output.push(line);
			if (
				fence &&
				fence[0] === fenceMarker[0] &&
				fence.length >= fenceMarker.length
			) {
				fenceMarker = "";
			}
			continue;
		}

		if (fence) {
			fenceMarker = fence;
			output.push(line);
			continue;
		}

		const match = line.match(DEFINITION_PATTERN);
		if (!match) {
			output.push(line);
			continue;
		}

		const [, term, expansion] = match;
		if (!isValidTerm(term) || !expansion.trim()) {
			output.push(line);
			continue;
		}
		if (definitions.has(term)) {
			output.push(
				`::${LITERAL_DEFINITION_NAME}{value="${escapeAttribute(line)}"}`,
			);
			continue;
		}

		definitions.add(term);
		output.push(
			`::${DEFINITION_NAME}{term="${term}" expansion="${escapeAttribute(expansion.trim())}"}`,
		);
		output.push("");
	}

	return output.join("\n");
}

function replaceReferences(parent, definitions, referencePattern, state) {
	if (
		!Array.isArray(parent.children) ||
		SKIPPED_PARENT_TYPES.has(parent.type)
	) {
		return;
	}

	const children = [];
	for (const child of parent.children) {
		if (child.type !== "text") {
			replaceReferences(child, definitions, referencePattern, state);
			children.push(child);
			continue;
		}

		const segments = [];
		let cursor = 0;
		for (const match of child.value.matchAll(referencePattern)) {
			const prefix = match[1];
			const term = match[2];
			const expansion = definitions.get(term);
			const start = match.index + prefix.length;
			if (start > cursor) {
				segments.push({
					type: "text",
					value: child.value.slice(cursor, start),
				});
			}
			state.referenceIndex += 1;
			const id = `m3-abbr-${state.referenceIndex}`;
			const anchorName = `--${id}`;
			segments.push({
				type: "abbreviation",
				data: {
					hName: "abbr",
					hProperties: {
						className: ["m3-abbreviation"],
						dataAbbreviationExpansion: expansion,
						ariaLabel: `${term}: ${expansion}`,
						tabIndex: 0,
						ariaDescribedBy: id,
						style: `anchor-name: ${anchorName}`,
					},
				},
				children: [{ type: "text", value: term }],
			});
			state.popovers.push({
				type: "abbreviationPopover",
				data: {
					hName: "span",
					hProperties: {
						id,
						className: ["m3-abbreviation__popover", "not-prose"],
						popover: "manual",
						role: "tooltip",
						style: `--m3-abbr-anchor: ${anchorName}`,
					},
				},
				children: [{ type: "text", value: expansion }],
			});
			cursor = start + term.length;
		}

		if (segments.length === 0) {
			children.push(child);
			continue;
		}
		if (cursor < child.value.length) {
			segments.push({ type: "text", value: child.value.slice(cursor) });
		}
		children.push(...segments);
	}
	parent.children = children;
}

export function remarkAbbreviations() {
	const parser = this.parser;
	if (typeof parser !== "function") {
		throw new TypeError(
			"remarkAbbreviations requires an initialized Markdown parser.",
		);
	}

	this.parser = function parseAbbreviations(source) {
		return parser(rewriteAbbreviationDefinitions(source));
	};

	return (tree) => {
		const definitions = new Map();
		const visibleChildren = [];
		for (const child of tree.children) {
			if (
				child.type === "leafDirective" &&
				child.name === LITERAL_DEFINITION_NAME
			) {
				const value = child.attributes?.value;
				if (typeof value === "string") {
					visibleChildren.push({
						type: "abbreviationLiteral",
						data: { hName: "p" },
						children: [{ type: "text", value }],
					});
				}
				continue;
			}
			if (child.type !== "leafDirective" || child.name !== DEFINITION_NAME) {
				visibleChildren.push(child);
				continue;
			}

			const term = child.attributes?.term;
			const expansion = child.attributes?.expansion;
			if (
				typeof term === "string" &&
				typeof expansion === "string" &&
				isValidTerm(term) &&
				expansion.trim() &&
				!definitions.has(term)
			) {
				definitions.set(term, expansion.trim());
			}
		}
		tree.children = visibleChildren;

		if (definitions.size > 0) {
			const terms = Array.from(definitions.keys())
				.sort((left, right) => right.length - left.length)
				.map(escapePattern)
				.join("|");
			const referencePattern = new RegExp(
				`(^|[^\\p{L}\\p{N}_])(${terms})(?=$|[^\\p{L}\\p{N}_])`,
				"gu",
			);
			const state = { referenceIndex: 0, popovers: [] };
			replaceReferences(tree, definitions, referencePattern, state);
			tree.children.push(...state.popovers);
		}
	};
}
