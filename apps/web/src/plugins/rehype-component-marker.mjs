import { h } from "hastscript";

const MARK_VARIANTS = new Set([
	"primary",
	"secondary",
	"tertiary",
	"error",
	"tip",
]);

/** Renders marker directives as semantic, token-driven inline highlights. */
export function MarkerComponent(properties, children) {
	const candidate = properties?.variant;
	const variant =
		typeof candidate === "string" && MARK_VARIANTS.has(candidate)
			? candidate
			: "primary";

	return h(
		"mark",
		{
			class: `m3-marker m3-marker--${variant}`,
			"data-marker": variant,
		},
		Array.isArray(children) ? children : [],
	);
}
