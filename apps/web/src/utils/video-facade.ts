type VideoFacade = HTMLElement & { dataset: DOMStringMap };

export function bindVideoFacadePreload(
	root: ParentNode,
	selector: string,
	activate: (facade: VideoFacade) => void,
): void {
	const facades = [
		...(root instanceof HTMLElement && root.matches(selector) ? [root] : []),
		...root.querySelectorAll<HTMLElement>(selector),
	];

	for (const facade of facades) {
		if (facade.dataset.videoPreload !== "auto") continue;
		if (facade.dataset.videoPreloadBound === "true") continue;
		facade.dataset.videoPreloadBound = "true";

		const prepare = () => activate(facade);
		if ("IntersectionObserver" in window) {
			const observer = new IntersectionObserver(
				(entries) => {
					if (!entries.some((entry) => entry.isIntersecting)) return;
					observer.disconnect();
					prepare();
				},
				{ rootMargin: "240px 0px" },
			);
			observer.observe(facade);
		} else {
			const idleWindow = window as Window & {
				requestIdleCallback?: (
					callback: IdleRequestCallback,
					options?: IdleRequestOptions,
				) => number;
			};
			if (idleWindow.requestIdleCallback) {
				idleWindow.requestIdleCallback(prepare, { timeout: 1500 });
			} else {
				setTimeout(prepare, 0);
			}
		}
	}
}
