import { visit } from "unist-util-visit";

import { getYouTubeEmbedData } from "./core/youtube.mjs";

function restoreDirectiveText(node) {
	const attributes = Object.entries(node.attributes ?? {})
		.map(([name, value]) => `${name}=${JSON.stringify(String(value))}`)
		.join(" ");

	node.type = "text";
	node.value = `::youtube${attributes ? `{${attributes}}` : ""}`;
	delete node.name;
	delete node.attributes;
	delete node.children;
	delete node.data;
}

/** Restores malformed YouTube directives as ordinary Markdown text. */
export function remarkYouTube() {
	return (tree) => {
		visit(tree, "leafDirective", (node) => {
			if (node.name === "youtube" && !getYouTubeEmbedData(node.attributes)) {
				restoreDirectiveText(node);
			}
		});
	};
}
