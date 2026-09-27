import { h } from "hastscript";

const MAX_TITLE_LENGTH = 200;

function isElement(node, tagName) {
	return Boolean(
		node?.type === "element" && (!tagName || node.tagName === tagName),
	);
}

function isWhitespace(node) {
	return node?.type === "text" && node.value.trim() === "";
}

function textContent(node) {
	if (!node) return "";
	if (Array.isArray(node)) return node.map(textContent).join("");
	if (node.type === "text") return node.value;
	return Array.isArray(node.children)
		? node.children.map(textContent).join("")
		: "";
}

function parseStartNumber(value, fallback = 1) {
	if (value === undefined || value === null) return fallback;
	const parsed = Number.parseInt(String(value).trim(), 10);
	return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function resolveTitle(value) {
	return typeof value === "string"
		? value.trim().slice(0, MAX_TITLE_LENGTH)
		: "";
}

function renderStepItem(itemChildren, index) {
	return h("li", { class: "m3-steps__item" }, [
		h(
			"span",
			{ class: "m3-steps__index", "aria-hidden": "true" },
			String(index),
		),
		h("div", { class: "m3-steps__content" }, itemChildren),
	]);
}

export function StepsComponent(properties, children = []) {
	let rawNodes = Array.isArray(children) ? [...children] : [];
	let title = resolveTitle(properties?.title);

	if (properties?.["has-directive-label"] && rawNodes.length > 0) {
		if (!title) title = resolveTitle(textContent(rawNodes[0]));
		rawNodes = rawNodes.slice(1);
	}

	const validNodes = rawNodes.filter((node) => !isWhitespace(node));
	const lists = validNodes.filter((node) => isElement(node, "ol"));

	// Invalid author input remains readable as ordinary Markdown.
	if (lists.length !== 1 || validNodes.some((node) => !isElement(node, "ol"))) {
		return validNodes;
	}

	const list = lists[0];
	const listItems = list.children.filter((child) => isElement(child, "li"));
	if (listItems.length === 0) return [];

	const start =
		properties?.start === undefined
			? parseStartNumber(list.properties?.start, 1)
			: parseStartNumber(properties.start, 1);
	const items = listItems.map((item, index) =>
		renderStepItem(item.children || [], start + index),
	);
	const listElement = h(
		"ol",
		{
			class: "m3-steps__list",
			start: String(start),
		},
		items,
	);

	const containerChildren = title
		? [h("p", { class: "m3-steps__title" }, title), listElement]
		: [listElement];
	const tagName = title ? "section" : "div";

	return h(
		tagName,
		{
			class: "m3-steps not-prose",
			...(title ? { "aria-label": title } : {}),
		},
		containerChildren,
	);
}
