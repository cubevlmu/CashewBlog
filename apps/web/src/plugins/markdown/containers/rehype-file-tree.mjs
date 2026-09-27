import { h } from "hastscript";
import { createDisclosure } from "../core/disclosure.mjs";
import {
	createFileTreeDisclosureIcon,
	createFileTreeHeaderIcon,
	createFileTreeIcon,
} from "../core/file-tree-icons.mjs";

const BRANCH_PREFIXES = ["├──", "└──", "+---", "\\---"];
const INDENT_PREFIXES = ["│   ", "|   ", "    "];
const MAX_TITLE_LENGTH = 200;

function isElement(node, tagName) {
	return node?.type === "element" && (!tagName || node.tagName === tagName);
}

function textContent(node) {
	if (!node) return "";
	if (Array.isArray(node)) return node.map(textContent).join("");
	if (node.type === "text") return node.value;
	return Array.isArray(node.children)
		? node.children.map(textContent).join("")
		: "";
}

function containsStrong(node) {
	if (!node || typeof node !== "object") return false;
	if (isElement(node, "strong")) return true;
	return Array.isArray(node.children) && node.children.some(containsStrong);
}

export function parseFileTreeEntry(value, emphasized = false) {
	let source = String(value).trim();
	let status = null;
	if (source.startsWith("++ ")) {
		status = "added";
		source = source.slice(3).trim();
	} else if (
		source.startsWith("-- ") ||
		source.startsWith("— ") ||
		source.startsWith("– ")
	) {
		status = "deleted";
		source = source.slice(source.startsWith("-- ") ? 3 : 2).trim();
	}

	let comment = "";
	const commentMatch = source.match(/^(.*?)\s+#\s+(.+)$/);
	if (commentMatch) {
		source = commentMatch[1].trim();
		comment = commentMatch[2].trim();
	}

	const hasDirectorySuffix = source.endsWith("/") || source.endsWith("\\");
	const name = hasDirectorySuffix ? source.slice(0, -1).trim() : source;
	return {
		name,
		status,
		comment,
		emphasized,
		isDirectory: hasDirectorySuffix,
		isExplicitDirectory: hasDirectorySuffix,
	};
}

function parseListItem(item) {
	const nestedList = item.children.find((child) => isElement(child, "ul"));
	const labelNodes = item.children.filter((child) => child !== nestedList);
	const entry = parseFileTreeEntry(
		textContent(labelNodes),
		labelNodes.some(containsStrong),
	);
	entry.children = nestedList ? parseMarkdownList(nestedList) : [];
	entry.isDirectory ||= entry.children.length > 0;
	return entry;
}

function parseMarkdownList(list) {
	return list.children
		.filter((child) => isElement(child, "li"))
		.map(parseListItem)
		.filter((entry) => entry.name);
}

function readUnicodeTreeLine(line) {
	const source = line.replaceAll("\t", "    ").trimEnd();
	if (!source.trim()) return null;

	let cursor = 0;
	let depth = 0;
	let matchedIndent = true;
	while (matchedIndent) {
		matchedIndent = false;
		for (const prefix of INDENT_PREFIXES) {
			if (source.startsWith(prefix, cursor)) {
				cursor += prefix.length;
				depth += 1;
				matchedIndent = true;
				break;
			}
		}
	}

	const branch = BRANCH_PREFIXES.find((prefix) =>
		source.startsWith(prefix, cursor),
	);
	if (branch) {
		cursor += branch.length;
		depth += 1;
	}

	const value = source.slice(cursor).trim();
	return value ? { depth, entry: parseFileTreeEntry(value) } : null;
}

export function parseUnicodeFileTree(source) {
	const roots = [];
	const stack = [];
	const parsedLines = String(source)
		.split(/\r?\n/)
		.map(readUnicodeTreeLine)
		.filter(Boolean);
	if (parsedLines.length === 0) return roots;

	const minimumDepth = Math.min(...parsedLines.map((line) => line.depth));

	for (const parsed of parsedLines) {
		const depth = Math.min(parsed.depth - minimumDepth, stack.length);
		const entry = { ...parsed.entry, children: [] };
		if (depth === 0) {
			roots.push(entry);
		} else {
			const parent = stack[depth - 1];
			parent.children.push(entry);
			parent.isDirectory = true;
		}
		stack[depth] = entry;
		stack.length = depth + 1;
	}

	return roots;
}

function renderRow(entry, iconMode, includeDisclosureSpacer) {
	const children = [];
	if (includeDisclosureSpacer) {
		children.push(
			h("span", {
				class: "m3-disclosure__indicator m3-disclosure__indicator--spacer",
				"aria-hidden": "true",
			}),
		);
	}
	children.push(
		h(
			"span",
			{ class: "m3-file-tree__diff" },
			entry.status === "added" ? "+" : entry.status === "deleted" ? "-" : "",
		),
		createFileTreeIcon(entry.name, entry.isDirectory, iconMode),
		h("span", { class: "m3-file-tree__name" }, entry.name),
	);
	if (entry.comment) {
		children.push(h("span", { class: "m3-file-tree__comment" }, entry.comment));
	}
	return children;
}

function renderEntry(entry, level, iconMode) {
	const className = [
		"m3-file-tree__node",
		entry.isDirectory
			? "m3-file-tree__node--directory"
			: "m3-file-tree__node--file",
	];
	if (entry.status) className.push(`m3-file-tree__node--${entry.status}`);
	if (entry.emphasized) className.push("m3-file-tree__node--emphasized");

	const hasChildren = entry.children.length > 0;
	const rowChildren = renderRow(entry, iconMode, !hasChildren);
	const children = hasChildren
		? [
				createDisclosure({
					summary: rowChildren,
					children: [
						renderList(entry.children, level + 1, iconMode, false, ""),
					],
					indicator: createFileTreeDisclosureIcon(),
					open: !entry.isExplicitDirectory,
					className: "m3-file-tree__disclosure",
					summaryClassName: "m3-file-tree__row",
					contentClassName: "m3-file-tree__branch",
				}),
			]
		: [h("div", { class: "m3-file-tree__row" }, rowChildren)];

	return h(
		"li",
		{ className, role: "treeitem", "aria-level": String(level) },
		children,
	);
}

function renderList(entries, level, iconMode, root, label) {
	return h(
		"ul",
		{
			class: root ? "m3-file-tree__root" : "m3-file-tree__children",
			role: root ? "tree" : "group",
			...(root && label ? { "aria-label": label } : {}),
		},
		entries.map((entry) => renderEntry(entry, level, iconMode)),
	);
}

function resolveTitle(value) {
	return typeof value === "string"
		? value.trim().slice(0, MAX_TITLE_LENGTH)
		: "";
}

function resolveIconMode(value) {
	return value === "simple" ? "simple" : "colored";
}

export function FileTreeComponent(properties, children) {
	const title = resolveTitle(properties?.title);
	const iconMode = resolveIconMode(properties?.icon);
	const list = children.find((child) => isElement(child, "ul"));
	const entries = list
		? parseMarkdownList(list)
		: properties?.syntax === "code"
			? parseUnicodeFileTree(textContent(children))
			: [];
	if (entries.length === 0) return [];

	const content = [];
	if (title) {
		content.push(
			h("div", { class: "m3-file-tree__header" }, [
				createFileTreeHeaderIcon(),
				h("span", { class: "m3-file-tree__title" }, title),
			]),
		);
	}
	content.push(renderList(entries, 1, iconMode, true, title));

	return h(
		"div",
		{
			class: "m3-file-tree not-prose",
			"data-icon-mode": iconMode,
			...(title ? { "aria-label": title } : {}),
		},
		content,
	);
}
