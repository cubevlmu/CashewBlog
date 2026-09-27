import materialSymbols from "@iconify-json/material-symbols/icons.json" with {
	type: "json",
};
import { h } from "hastscript";

import { getAudioReaderEmbedData } from "./markdown/core/audio-reader.mjs";

const speakerIcon = materialSymbols.icons["volume-up-rounded"];
const speakerPath = speakerIcon.body.match(
	/^<path fill="(?<fill>[^"]+)" d="(?<data>[^"]+)"\/>$/,
);

if (!speakerPath?.groups) {
	throw new TypeError("Unsupported Audio Reader speaker icon body");
}

function createSpeakerIcon() {
	return h(
		"svg",
		{
			class: "m3-audio-reader__speaker",
			viewBox: `0 0 ${speakerIcon.width ?? materialSymbols.width ?? 24} ${speakerIcon.height ?? materialSymbols.height ?? 24}`,
			ariaHidden: true,
			focusable: false,
		},
		[h("path", { fill: speakerPath.groups.fill, d: speakerPath.groups.data })],
	);
}

/** Renders a plain inline label with a progressively enhanced speaker control. */
export function AudioReaderComponent(properties, children) {
	const title = typeof properties?.title === "string" ? properties.title : "";
	const embed = getAudioReaderEmbedData(properties, title);
	if (!embed) return null;
	const { src } = embed;
	const content = Array.isArray(children) ? children : [];

	return h(
		"span",
		{
			class: "m3-audio-reader not-prose",
			dataAudioReader: true,
			dataAudioReaderState: "paused",
		},
		[
			h("audio", {
				class: "m3-audio-reader__media",
				dataAudioReaderMedia: true,
				src,
				preload: "none",
				hidden: true,
			}),
			h("span", { class: "m3-audio-reader__source" }, content),
			h(
				"button",
				{
					type: "button",
					class: "m3-audio-reader__toggle m3-state-layer",
					dataAudioReaderToggle: true,
					ariaLabel: title,
					ariaPressed: "false",
				},
				createSpeakerIcon(),
			),
		],
	);
}
