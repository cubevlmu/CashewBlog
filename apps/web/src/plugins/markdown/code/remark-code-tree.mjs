import { visit } from "unist-util-visit";

const META_ATTRIBUTE_PATTERN =
	/(?:(?<name>[A-Za-z:][\w:-]*)(?:=(?:"(?<double>[^"]*)"|'(?<single>[^']*)'|(?<bare>[^\s"'=<>`]+)))?)/g;

export function parseCodeTreeFenceMeta(meta = "") {
	const normalized = String(meta).replace(/[“”]/g, '"').replace(/[‘’]/g, "'");
	const attributes = {};
	for (const match of normalized.matchAll(META_ATTRIBUTE_PATTERN)) {
		const { name, double, single, bare } = match.groups;
		if (!name) continue;
		if (double !== undefined || single !== undefined || bare !== undefined) {
			attributes[name] = double ?? single ?? bare ?? "";
		} else {
			attributes[name] = true;
		}
	}
	return attributes;
}

/**
 * `:::code-tree` groups the fenced code blocks it contains into one tabbed
 * file tree. Importing a directory from the server's disk is deliberately not
 * supported: post Markdown comes from the database, not the repository.
 */
export function remarkCodeTree() {
	return (tree) => {
		// Process containerDirective :::code-tree
		visit(tree, (node) => {
			if (node.type === "containerDirective" && node.name === "code-tree") {
				const files = [];
				let codeIndex = 0;
				for (const child of node.children || []) {
					if (child.type === "code") {
						const meta = parseCodeTreeFenceMeta(child.meta);
						let filePath =
							meta.title ||
							meta.file ||
							`file-${codeIndex + 1}.${child.lang || "txt"}`;
						filePath = String(filePath)
							.replace(/\\/g, "/")
							.replace(/^\.?\//, "")
							.trim();
						const active = Boolean(meta[":active"] || meta.active);

						files.push({
							path: filePath,
							lang: child.lang || "text",
							active,
							index: codeIndex,
						});

						child.data = child.data || {};
						child.data.hProperties = {
							...(child.data.hProperties || {}),
							"data-file-path": filePath,
							"data-file-index": codeIndex,
						};

						codeIndex++;
					}
				}

				node.attributes = node.attributes || {};
				node.attributes.files = JSON.stringify(files);
				node.data = node.data || {};
				node.data.hName = "code-tree";
				node.data.hProperties = {
					...node.attributes,
					files: JSON.stringify(files),
				};
			}
		});
	};
}
