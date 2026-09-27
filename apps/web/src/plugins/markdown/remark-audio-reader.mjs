import { visit } from "unist-util-visit";

import { getAudioReaderEmbedData } from "./core/audio-reader.mjs";

function getDirectiveLabel(children = []) {
	return children
		.map((child) => (typeof child.value === "string" ? child.value : ""))
		.join("")
		.trim();
}

function restoreDirectiveText(node) {
	const label = getDirectiveLabel(node.children);
	const attributes = Object.entries(node.attributes ?? {})
		.map(([name, value]) => `${name}=${JSON.stringify(String(value))}`)
		.join(" ");

	node.type = "text";
	node.value = `:audio-reader[${label}]{${attributes}}`;
	delete node.name;
	delete node.attributes;
	delete node.children;
	delete node.data;
}

/** Validates compact audio reader directives before feature probing. */
export function remarkAudioReader() {
	return (tree) => {
		visit(tree, "textDirective", (node) => {
			if (node.name !== "audio-reader") return;

			const embed = getAudioReaderEmbedData(
				node.attributes,
				getDirectiveLabel(node.children),
			);
			if (!embed) {
				restoreDirectiveText(node);
				return;
			}

			node.attributes.title = embed.title;
		});
	};
}
