import { getAcFunPlayerUrl } from "../plugins/markdown/core/acfun.mjs";
import { bindVideoFacadePreload } from "./video-facade";

export function activateAcFunFacade(facade: HTMLElement): void {
	if (facade.dataset.acfunState === "active") return;

	const stage = facade.querySelector<HTMLElement>(".m3-acfun__stage");
	const button = facade.querySelector<HTMLButtonElement>(
		"[data-acfun-activate]",
	);
	const playerUrl = getAcFunPlayerUrl(facade.dataset.acfunAcid ?? "");
	if (!stage || !button || !playerUrl) return;

	const player = document.createElement("iframe");
	player.className = "m3-acfun__player";
	player.src = playerUrl;
	player.title = facade.dataset.acfunTitle ?? "AcFun";
	player.loading = "lazy";
	player.referrerPolicy = "strict-origin-when-cross-origin";
	player.allow = "fullscreen; picture-in-picture";
	player.allowFullscreen = true;
	player.addEventListener(
		"error",
		() => {
			player.remove();
			button.disabled = false;
			facade.dataset.acfunState = "error";
		},
		{ once: true },
	);

	button.disabled = true;
	stage.append(player);
	facade.dataset.acfunState = "active";
}

/** Binds only facades in the supplied Markdown root; no global state persists. */
export function initAcFunEmbeds(root: ParentNode = document): void {
	const facades = [
		...(root instanceof HTMLElement && root.matches("[data-acfun]")
			? [root]
			: []),
		...root.querySelectorAll<HTMLElement>("[data-acfun]"),
	];

	for (const facade of facades) {
		if (facade.dataset.acfunBound === "true") continue;
		const button = facade.querySelector<HTMLButtonElement>(
			"[data-acfun-activate]",
		);
		if (!button) continue;

		facade.dataset.acfunBound = "true";
		button.addEventListener("click", () => activateAcFunFacade(facade));
	}
	bindVideoFacadePreload(root, "[data-acfun]", activateAcFunFacade);
}
