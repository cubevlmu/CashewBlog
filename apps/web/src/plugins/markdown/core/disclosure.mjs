import { h } from "hastscript";

function classNames(base, extra) {
	return [base, ...(Array.isArray(extra) ? extra : [extra])].filter(Boolean);
}

/**
 * Builds a native disclosure node that Markdown components can compose without
 * hydration. Consumers own the summary contents and the disclosed body.
 */
export function createDisclosure({
	summary,
	children,
	indicator,
	open = false,
	name,
	className,
	summaryClassName,
	contentClassName,
}) {
	return h(
		"details",
		{
			className: classNames("m3-disclosure", className),
			...(open ? { open: true } : {}),
			...(name ? { name } : {}),
		},
		[
			h(
				"summary",
				{
					className: classNames("m3-disclosure__summary", summaryClassName),
				},
				[
					h(
						"span",
						{ className: ["m3-disclosure__indicator"], "aria-hidden": "true" },
						indicator ? [indicator] : [],
					),
					...summary,
				],
			),
			h(
				"div",
				{
					className: classNames("m3-disclosure__content", contentClassName),
				},
				children,
			),
		],
	);
}
