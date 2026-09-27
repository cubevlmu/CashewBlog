import { h } from "hastscript";
import { getArtPlayerEmbedData } from "./markdown/core/artplayer.mjs";

/** Renders a native video player without a client-side player dependency. */
export function ArtPlayerComponent(properties, children) {
	if (Array.isArray(children) && children.length !== 0) return null;

	const embed = getArtPlayerEmbedData(properties);
	if (!embed) return null;
	const { src, title, preload } = embed;

	return h("figure", { class: "m3-artplayer not-prose", dataArtplayer: true }, [
		h("video", {
			class: "m3-artplayer__video",
			src,
			controls: true,
			preload,
			playsInline: true,
			ariaLabel: title,
		}),
		h("figcaption", { class: "m3-artplayer__caption" }, [
			h("strong", { class: "m3-artplayer__title" }, title),
			h(
				"a",
				{
					class: "m3-artplayer__source m3-state-layer",
					href: src,
					target: "_blank",
					rel: "noopener noreferrer",
				},
				src,
			),
		]),
	]);
}
