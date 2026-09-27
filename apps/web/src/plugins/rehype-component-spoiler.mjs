import { h } from "hastscript";

/** Renders inline spoiler content as a keyboard and touch accessible button. */
export function SpoilerComponent(_properties, children) {
	return h(
		"button",
		{
			type: "button",
			class: "m3-spoiler m3-state-layer",
			dataSpoiler: true,
			"aria-expanded": "false",
		},
		Array.isArray(children) ? children : [],
	);
}
