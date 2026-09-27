import { visit } from "unist-util-visit";

/**
 * Keep Mermaid fences out of Expressive Code while preserving a readable
 * source fallback for browsers where client-side rendering is unavailable.
 */
export function remarkMermaid() {
	return (tree) => {
		visit(tree, "code", (node) => {
			if (node.lang?.toLowerCase() !== "mermaid") return;

			const source = node.value;
			node.type = "mermaid";
			node.data = {
				hName: "figure",
				hProperties: {
					className: ["markdown-mermaid"],
					"data-mermaid": "",
					"data-mermaid-state": "pending",
				},
				hChildren: [
					{
						type: "element",
						tagName: "div",
						properties: { className: ["markdown-mermaid__surface"] },
						children: [
							{
								type: "element",
								tagName: "pre",
								properties: {
									className: ["markdown-mermaid__fallback"],
								},
								children: [{ type: "text", value: source }],
							},
							{
								type: "element",
								tagName: "div",
								properties: {
									className: ["markdown-mermaid__diagram"],
								},
								children: [],
							},
						],
					},
				],
			};
			delete node.lang;
			delete node.meta;
			delete node.value;
		});
	};
}
