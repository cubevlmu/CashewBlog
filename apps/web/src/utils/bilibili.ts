import { getBilibiliPlayerUrl } from "../plugins/markdown/core/bilibili.mjs";
import { bindVideoFacadePreload } from "./video-facade";

export function activateBilibiliFacade(facade: HTMLElement): void {
	if (facade.dataset.bilibiliState === "active") return;

	const stage = facade.querySelector<HTMLElement>(".m3-bilibili__stage");
	const button = facade.querySelector<HTMLButtonElement>(
		"[data-bilibili-activate]",
	);
	const playerUrl = getBilibiliPlayerUrl(
		facade.dataset.bilibiliBvid ?? "",
		facade.dataset.bilibiliPart ?? "",
	);
	if (!stage || !button || !playerUrl) return;

	const player = document.createElement("iframe");
	player.className = "m3-bilibili__player";
	player.src = playerUrl;
	player.title = facade.dataset.bilibiliTitle ?? "Bilibili";
	player.loading = "lazy";
	player.referrerPolicy = "strict-origin-when-cross-origin";
	player.allow = "fullscreen; picture-in-picture";
	player.allowFullscreen = true;
	player.addEventListener(
		"error",
		() => {
			player.remove();
			button.disabled = false;
			facade.dataset.bilibiliState = "error";
		},
		{ once: true },
	);

	button.disabled = true;
	stage.append(player);
	facade.dataset.bilibiliState = "active";
}

/** Binds only facades in the supplied Markdown root; no global state persists. */
export function initBilibiliEmbeds(root: ParentNode = document): void {
	const facades = [
		...(root instanceof HTMLElement && root.matches("[data-bilibili]")
			? [root]
			: []),
		...root.querySelectorAll<HTMLElement>("[data-bilibili]"),
	];

	for (const facade of facades) {
		if (facade.dataset.bilibiliBound === "true") continue;
		const button = facade.querySelector<HTMLButtonElement>(
			"[data-bilibili-activate]",
		);
		if (!button) continue;

		facade.dataset.bilibiliBound = "true";
		button.addEventListener("click", () => activateBilibiliFacade(facade));
	}
	bindVideoFacadePreload(root, "[data-bilibili]", activateBilibiliFacade);
}
