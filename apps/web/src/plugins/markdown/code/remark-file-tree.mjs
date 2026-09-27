import { visit } from "unist-util-visit";

const META_ATTRIBUTE_PATTERN =
	/(?<name>[A-Za-z][\w-]*)=(?:"(?<double>[^"]*)"|'(?<single>[^']*)'|(?<bare>\S+))/g;

export function parseFileTreeFenceMeta(meta = "") {
	const attributes = {};
	for (const match of String(meta).matchAll(META_ATTRIBUTE_PATTERN)) {
		const { name, double, single, bare } = match.groups;
		attributes[name] = double ?? single ?? bare ?? "";
	}
	return attributes;
}

/**
 * Turns a `file-tree` fence into the same custom HAST element used by the
 * container directive, keeping both authoring syntaxes on one renderer.
 */
export function remarkFileTree() {
	return (tree) => {
		visit(tree, "code", (node) => {
			if (node.lang?.toLowerCase() !== "file-tree") return;

			const source = node.value;
			const properties = parseFileTreeFenceMeta(node.meta);
			node.type = "fileTree";
			node.data = {
				hName: "file-tree",
				hProperties: { ...properties, syntax: "code" },
				hChildren: [{ type: "text", value: source }],
			};
			delete node.lang;
			delete node.meta;
			delete node.value;
		});
	};
}
