import { h } from "hastscript";
import { getYouTubeEmbedData } from "./markdown/core/youtube.mjs";

/**
 * Renders a static YouTube facade. The player is only created after the
 * browser-side runtime receives an explicit activation.
 */
export function YouTubeComponent(properties, children) {
	if (Array.isArray(children) && children.length !== 0) return null;

	const embed = getYouTubeEmbedData(properties);
	if (!embed) return null;
	const { id, title, preload } = embed;

	const stageChildren = [
		h(
			"button",
			{
				class: "m3-youtube__play m3-state-layer",
				type: "button",
				dataYoutubeActivate: true,
				ariaLabel: title,
			},
			[h("span", { class: "m3-youtube__play-icon", "aria-hidden": "true" })],
		),
	];

	return h(
		"figure",
		{
			class: "m3-youtube not-prose",
			dataYoutube: true,
			dataYoutubeId: id,
			dataYoutubeTitle: title,
			dataVideoPreload: preload,
		},
		[
			h("div", { class: "m3-youtube__stage" }, stageChildren),
			h("figcaption", { class: "m3-youtube__caption" }, [
				h("strong", { class: "m3-youtube__title" }, title),
				h(
					"a",
					{
						class: "m3-youtube__source m3-state-layer",
						href: `https://www.youtube.com/watch?v=${id}`,
						target: "_blank",
						rel: "noopener noreferrer",
					},
					"YouTube",
				),
			]),
		],
	);
}
