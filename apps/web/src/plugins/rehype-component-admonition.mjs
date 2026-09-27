/// <reference types="mdast" />
import { h } from "hastscript";

const MAX_TITLE_LENGTH = 200;

function textContent(node) {
	if (!node) return "";
	if (Array.isArray(node)) return node.map(textContent).join("");
	if (node.type === "text") return node.value;
	return Array.isArray(node.children)
		? node.children.map(textContent).join("")
		: "";
}

function resolveTitle(value) {
	return typeof value === "string"
		? value.trim().slice(0, MAX_TITLE_LENGTH)
		: "";
}

function titleNodes(label, fallback) {
	if (Array.isArray(label?.children) && label.children.length > 0) {
		return label.children;
	}
	return fallback;
}

function renderIndicator() {
	return h("span", {
		class: "m3-admonition__indicator",
		"aria-hidden": "true",
	});
}

/**
 * Renders every supported admonition syntax through one SSR-only component.
 */
export function AdmonitionComponent(properties, children, type) {
	const content = Array.isArray(children) ? [...children] : [];
	let label = null;
	let title = resolveTitle(properties.title);

	if (properties["has-directive-label"] && content.length > 0) {
		label = content.shift();
		if (!title) title = resolveTitle(textContent(label));
	}

	const fallbackTitle = title || type.toUpperCase();
	const renderedTitle = titleNodes(label, fallbackTitle);
	const rootProperties = {
		class: `admonition bdm-${type} m3-admonition not-prose`,
		"data-admonition": type,
	};
	const body = content.length
		? h("div", { class: "m3-admonition__body" }, content)
		: null;

	if (type === "details") {
		return h("details", rootProperties, [
			h("summary", { class: "m3-admonition__header m3-state-layer" }, [
				renderIndicator(),
				h("span", { class: "bdm-title m3-admonition__title" }, renderedTitle),
				h("span", {
					class: "m3-admonition__chevron",
					"aria-hidden": "true",
				}),
			]),
			...(body ? [body] : []),
		]);
	}

	return h("aside", { ...rootProperties, role: "note" }, [
		h("div", { class: "m3-admonition__header" }, [
			renderIndicator(),
			h("span", { class: "bdm-title m3-admonition__title" }, renderedTitle),
		]),
		...(body ? [body] : []),
	]);
}
