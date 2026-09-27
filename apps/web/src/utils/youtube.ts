import { getYouTubePlayerUrl } from "../plugins/markdown/core/youtube.mjs";
import { bindVideoFacadePreload } from "./video-facade";

export function activateYouTubeFacade(facade: HTMLElement): void {
	if (facade.dataset.youtubeState === "active") return;

	const stage = facade.querySelector<HTMLElement>(".m3-youtube__stage");
	const button = facade.querySelector<HTMLButtonElement>(
		"[data-youtube-activate]",
	);
	const playerUrl = getYouTubePlayerUrl(facade.dataset.youtubeId ?? "");
	if (!stage || !button || !playerUrl) return;

	const player = document.createElement("iframe");
	player.className = "m3-youtube__player";
	player.src = playerUrl;
	player.title = facade.dataset.youtubeTitle ?? "YouTube";
	player.loading = "lazy";
	player.referrerPolicy = "strict-origin-when-cross-origin";
	player.allow = "fullscreen; picture-in-picture";
	player.allowFullscreen = true;
	player.addEventListener(
		"error",
		() => {
			player.remove();
			button.disabled = false;
			facade.dataset.youtubeState = "error";
		},
		{ once: true },
	);

	button.disabled = true;
	stage.append(player);
	facade.dataset.youtubeState = "active";
}

/** Binds only facades in the supplied Markdown root; no global state persists. */
export function initYouTubeEmbeds(root: ParentNode = document): void {
	const facades = [
		...(root instanceof HTMLElement && root.matches("[data-youtube]")
			? [root]
			: []),
		...root.querySelectorAll<HTMLElement>("[data-youtube]"),
	];

	for (const facade of facades) {
		if (facade.dataset.youtubeBound === "true") continue;
		const button = facade.querySelector<HTMLButtonElement>(
			"[data-youtube-activate]",
		);
		if (!button) continue;

		facade.dataset.youtubeBound = "true";
		button.addEventListener("click", () => activateYouTubeFacade(facade));
	}
	bindVideoFacadePreload(root, "[data-youtube]", activateYouTubeFacade);
}
