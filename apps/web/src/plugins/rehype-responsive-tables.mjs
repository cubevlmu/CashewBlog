/**
 * Wrap Markdown tables in a focusable horizontal scroll container.
 * The table keeps its native semantics while the wrapper owns overflow.
 */

function transformChildren(parent) {
	const children = parent.children;
	if (!Array.isArray(children)) return;
	const alreadyWrapped =
		parent.type === "element" &&
		parent.tagName === "div" &&
		parent.properties?.className?.includes?.("markdown-table-scroll");

	parent.children = children.map((child) => {
		if (child?.type !== "element") return child;

		transformChildren(child);
		if (child.tagName !== "table" || alreadyWrapped) return child;

		return {
			type: "element",
			tagName: "div",
			properties: {
				className: ["markdown-table-scroll"],
				tabIndex: 0,
			},
			children: [child],
		};
	});
}

export function rehypeResponsiveTables() {
	return (tree) => {
		transformChildren(tree);
	};
}
