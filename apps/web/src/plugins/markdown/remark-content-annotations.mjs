const DEFINITION_NAME = "content-note-definition";
const DEFINITION_PATTERN = /^\[\+([^\]\s"{}=]+)\]:[ \t]*(.*)$/u;
const REFERENCE_PATTERN = /\[\+([^\]\s]+)\]/gu;
const FENCE_PATTERN = /^ {0,3}(`{3,}|~{3,})/;
const SKIPPED_PARENT_TYPES = new Set([
	"code",
	"definition",
	"image",
	"imageReference",
	"inlineCode",
	"link",
	"linkReference",
]);

function cloneNode(value) {
	if (Array.isArray(value)) return value.map(cloneNode);
	if (!value || typeof value !== "object") return value;
	return Object.fromEntries(
		Object.entries(value).map(([key, child]) => [key, cloneNode(child)]),
	);
}

function isIndentedDefinitionLine(line) {
	return line.startsWith("  ") || line.startsWith("\t");
}

function removeDefinitionIndent(line) {
	return line.startsWith("\t") ? line.slice(1) : line.slice(2);
}

export function rewriteContentAnnotationDefinitions(source) {
	const lines = String(source).split(/\r?\n/);
	const output = [];
	let fenceMarker = "";

	for (let index = 0; index < lines.length; index += 1) {
		const line = lines[index];
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

		const definition = line.match(DEFINITION_PATTERN);
		if (!definition) {
			output.push(line);
			continue;
		}

		const [, label, inlineContent] = definition;
		const content = inlineContent ? [inlineContent] : [];
		let nextIndex = index + 1;

		while (nextIndex < lines.length) {
			const nextLine = lines[nextIndex];
			if (nextLine.trim() === "") {
				content.push("");
				nextIndex += 1;
				continue;
			}
			if (!isIndentedDefinitionLine(nextLine)) break;
			content.push(removeDefinitionIndent(nextLine));
			nextIndex += 1;
		}

		while (content.at(-1) === "") content.pop();
		if (!content.some((contentLine) => contentLine.trim() !== "")) {
			output.push(...lines.slice(index, nextIndex));
			index = nextIndex - 1;
			continue;
		}

		output.push(`:::${DEFINITION_NAME}{label="${label}"}`);
		output.push(...content);
		output.push(":::");
		index = nextIndex - 1;
	}

	return output.join("\n");
}

function createDefinitionBody(definitions) {
	if (definitions.length === 1) {
		return {
			type: "contentAnnotationBody",
			data: {
				hName: "div",
				hProperties: { className: ["m3-content-note__body"] },
			},
			children: cloneNode(definitions[0]),
		};
	}

	return {
		type: "list",
		ordered: true,
		spread: true,
		data: {
			hName: "ol",
			hProperties: { className: ["m3-content-note__list"] },
		},
		children: definitions.map((definition) => ({
			type: "listItem",
			spread: true,
			data: {
				hName: "li",
				hProperties: { className: ["m3-content-note__item"] },
			},
			children: cloneNode(definition),
		})),
	};
}

function createAnnotationReference(label, definitions, index) {
	const id = `m3-content-note-${index}`;
	const anchorName = `--${id}`;
	const trigger = {
		type: "contentAnnotationReference",
		data: {
			hName: "button",
			hProperties: {
				type: "button",
				className: ["m3-content-note__trigger", "m3-state-layer"],
				popovertarget: id,
				ariaLabel: label,
				style: `anchor-name: ${anchorName}`,
			},
		},
		children: [
			{
				type: "text",
				value: "+",
				data: {
					hName: "span",
					hProperties: { ariaHidden: "true" },
				},
			},
		],
	};
	const popover = {
		type: "contentAnnotationPopover",
		data: {
			hName: "aside",
			hProperties: {
				id,
				className: ["m3-content-note__popover", "not-prose"],
				popover: "auto",
				role: "note",
				ariaLabel: label,
				style: `--content-note-anchor: ${anchorName}`,
			},
		},
		children: [
			{
				type: "paragraph",
				data: {
					hName: "p",
					hProperties: { className: ["m3-content-note__label"] },
				},
				children: [{ type: "text", value: label }],
			},
			createDefinitionBody(definitions),
		],
	};

	return { trigger, popover };
}

function transformReferences(parent, definitions, popovers, state) {
	if (
		!Array.isArray(parent.children) ||
		SKIPPED_PARENT_TYPES.has(parent.type)
	) {
		return;
	}

	const children = [];
	for (const child of parent.children) {
		if (child.type !== "text") {
			transformReferences(child, definitions, popovers, state);
			children.push(child);
			continue;
		}

		let cursor = 0;
		for (const match of child.value.matchAll(REFERENCE_PATTERN)) {
			const label = match[1];
			const annotationDefinitions = definitions.get(label);
			if (!annotationDefinitions?.length) continue;

			if (match.index > cursor) {
				children.push({
					type: "text",
					value: child.value.slice(cursor, match.index),
				});
			}
			state.referenceIndex += 1;
			const { trigger, popover } = createAnnotationReference(
				label,
				annotationDefinitions,
				state.referenceIndex,
			);
			children.push(trigger);
			popovers.push(popover);
			cursor = match.index + match[0].length;
		}

		if (cursor === 0) {
			children.push(child);
		} else if (cursor < child.value.length) {
			children.push({ type: "text", value: child.value.slice(cursor) });
		}
	}
	parent.children = children;
}

export function remarkContentAnnotations() {
	const parser = this.parser;
	if (typeof parser !== "function") {
		throw new TypeError(
			"remarkContentAnnotations requires an initialized Markdown parser.",
		);
	}

	this.parser = function parseContentAnnotations(source) {
		return parser(rewriteContentAnnotationDefinitions(source));
	};

	return (tree) => {
		const definitions = new Map();
		const visibleChildren = [];

		for (const child of tree.children) {
			if (
				child.type !== "containerDirective" ||
				child.name !== DEFINITION_NAME
			) {
				visibleChildren.push(child);
				continue;
			}

			const label = child.attributes?.label;
			if (typeof label !== "string" || !label || child.children.length === 0) {
				continue;
			}
			const entries = definitions.get(label) ?? [];
			entries.push(child.children);
			definitions.set(label, entries);
		}

		tree.children = visibleChildren;
		if (definitions.size === 0) return;

		const popovers = [];
		transformReferences(tree, definitions, popovers, { referenceIndex: 0 });
		tree.children.push(...popovers);
	};
}
