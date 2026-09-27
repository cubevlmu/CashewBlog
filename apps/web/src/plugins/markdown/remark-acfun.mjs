import { visit } from "unist-util-visit";

import { getAcFunEmbedData } from "./core/acfun.mjs";

function restoreDirectiveText(node) {
	const attributes = Object.entries(node.attributes ?? {})
		.map(([name, value]) => `${name}=${JSON.stringify(String(value))}`)
		.join(" ");

	node.type = "text";
	node.value = `::acfun${attributes ? `{${attributes}}` : ""}`;
	delete node.name;
	delete node.attributes;
	delete node.children;
	delete node.data;
}

/** Restores malformed AcFun directives as ordinary Markdown text. */
export function remarkAcFun() {
	return (tree) => {
		visit(tree, "leafDirective", (node) => {
			if (node.name === "acfun" && !getAcFunEmbedData(node.attributes)) {
				restoreDirectiveText(node);
			}
		});
	};
}
