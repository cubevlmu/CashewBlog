import { visit } from "unist-util-visit";

import { getBilibiliEmbedData } from "./core/bilibili.mjs";

function restoreDirectiveText(node) {
	const attributes = Object.entries(node.attributes ?? {})
		.map(([name, value]) => `${name}=${JSON.stringify(String(value))}`)
		.join(" ");

	node.type = "text";
	node.value = `::bilibili${attributes ? `{${attributes}}` : ""}`;
	delete node.name;
	delete node.attributes;
	delete node.children;
	delete node.data;
}

/** Restores malformed Bilibili directives as ordinary Markdown text. */
export function remarkBilibili() {
	return (tree) => {
		visit(tree, "leafDirective", (node) => {
			if (node.name === "bilibili" && !getBilibiliEmbedData(node.attributes)) {
				restoreDirectiveText(node);
			}
		});
	};
}
