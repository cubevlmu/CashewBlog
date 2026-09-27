import { h } from "hastscript";
import { visit } from "unist-util-visit";

import { createDisclosure } from "../core/disclosure.mjs";

function isElement(node, tagName) {
	return Boolean(
		node?.type === "element" && (!tagName || node.tagName === tagName),
	);
}

function isWhitespace(node) {
	return node?.type === "text" && node.value.trim() === "";
}

function isEnabled(value) {
	return (
		value === true || value === "" || String(value).toLowerCase() === "true"
	);
}

function textContent(node) {
	if (!node) return "";
	if (Array.isArray(node)) return node.map(textContent).join("");
	if (node.type === "text") return node.value;
	return Array.isArray(node.children)
		? node.children.map(textContent).join("")
		: "";
}

function cloneTitleNodes(nodes) {
	let marker = null;
	let inspectedFirstText = false;

	function clone(node) {
		if (!node || typeof node !== "object") return node;
		if (node.type === "text") {
			if (inspectedFirstText) return { ...node };
			inspectedFirstText = true;
			const match = node.value.match(/^:([+-])(?:[\t ]+|$)/);
			if (!match) return { ...node };
			marker = match[1];
			return { ...node, value: node.value.slice(match[0].length) };
		}
		return {
			...node,
			...(Array.isArray(node.children)
				? { children: node.children.map(clone) }
				: {}),
		};
	}

	return { children: nodes.map(clone), marker };
}

function parseItems(children) {
	const visibleChildren = children.filter((node) => !isWhitespace(node));
	if (visibleChildren.length !== 1 || !isElement(visibleChildren[0], "ul")) {
		return { fallback: visibleChildren, items: null };
	}

	const listChildren = visibleChildren[0].children.filter(
		(node) => !isWhitespace(node),
	);
	if (
		listChildren.length === 0 ||
		listChildren.some((node) => !isElement(node, "li"))
	) {
		return { fallback: visibleChildren, items: null };
	}

	const items = [];
	for (const listItem of listChildren) {
		const blocks = listItem.children.filter((node) => !isWhitespace(node));
		if (blocks.length < 2 || !isElement(blocks[0], "p")) {
			return { fallback: visibleChildren, items: null };
		}

		const title = cloneTitleNodes(blocks[0].children || []);
		if (!textContent(title.children).trim()) {
			return { fallback: visibleChildren, items: null };
		}
		items.push({
			title: title.children,
			marker: title.marker,
			body: blocks.slice(1),
		});
	}

	return { fallback: visibleChildren, items };
}

function renderItem({ item, open, name }) {
	return createDisclosure({
		className: "m3-collapse__item",
		summaryClassName: ["m3-collapse__summary", "m3-state-layer"],
		contentClassName: "m3-collapse__content",
		open,
		indicator: h("span", { className: "m3-collapse__chevron" }),
		summary: [h("span", { className: "m3-collapse__title" }, item.title)],
		children: item.body,
		...(name ? { name } : {}),
	});
}

export function CollapsePanelsComponent(properties, children = []) {
	const { fallback, items } = parseItems(
		Array.isArray(children) ? children : [],
	);
	if (!items) return fallback;

	const accordion = isEnabled(properties?.accordion);
	const expand = isEnabled(properties?.expand);
	const groupName = accordion ? properties?.dataCollapseGroup : undefined;
	const markedOpenIndex = items.findIndex((item) => item.marker === "+");
	const accordionOpenIndex =
		markedOpenIndex >= 0 ? markedOpenIndex : expand ? 0 : -1;
	const panels = items.map((item, index) => {
		const open = accordion
			? index === accordionOpenIndex
			: item.marker === "+" || (expand && item.marker !== "-");
		return renderItem({ item, open, name: groupName });
	});

	return h(
		"div",
		{
			className: "m3-collapse not-prose",
			dataCollapseMode: accordion ? "accordion" : "multiple",
		},
		panels,
	);
}

/** Assigns a deterministic, document-local name to each native accordion. */
export function rehypeCollapseGroups() {
	return (tree) => {
		let groupIndex = 0;
		visit(tree, "element", (node) => {
			if (
				node.tagName !== "collapse" ||
				!isEnabled(node.properties?.accordion)
			) {
				return;
			}
			groupIndex += 1;
			node.properties ||= {};
			node.properties.dataCollapseGroup = `shirone-collapse-${groupIndex}`;
		});
	};
}
