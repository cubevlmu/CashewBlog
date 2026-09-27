import { visit } from "unist-util-visit";

import { getArtPlayerEmbedData } from "./core/artplayer.mjs";

function restoreDirectiveText(node) {
	const attributes = Object.entries(node.attributes ?? {})
		.map(([name, value]) => `${name}=${JSON.stringify(String(value))}`)
		.join(" ");

	node.type = "text";
	node.value = `::artplayer${attributes ? `{${attributes}}` : ""}`;
	delete node.name;
	delete node.attributes;
	delete node.children;
	delete node.data;
}

/** Restores malformed ArtPlayer directives as ordinary Markdown text. */
export function remarkArtPlayer() {
	return (tree) => {
		visit(tree, "leafDirective", (node) => {
			if (
				node.name === "artplayer" &&
				!getArtPlayerEmbedData(node.attributes)
			) {
				restoreDirectiveText(node);
			}
		});
	};
}
