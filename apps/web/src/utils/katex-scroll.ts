import I18nKey from "@i18n/i18nKey";
import { i18n } from "@i18n/translation";

const observed = new WeakSet<HTMLElement>();

async function enhanceKaTeXDisplay(element: HTMLElement): Promise<void> {
	if (!element.parentNode || element.dataset.scrollbarInitialized === "true") {
		return;
	}

	const existingContainer = element.parentElement?.classList.contains(
		"katex-display-container",
	)
		? element.parentElement
		: null;
	const container = existingContainer ?? document.createElement("div");
	if (!existingContainer) {
		container.className = "katex-display-container";
		element.parentNode.insertBefore(container, element);
		container.appendChild(element);
	}
	container.setAttribute("aria-label", i18n(I18nKey.formulaScrollable));

	const { OverlayScrollbars } = await import("overlayscrollbars");
	OverlayScrollbars(container, {
		scrollbars: {
			theme: "scrollbar-base scrollbar-auto",
			autoHide: "leave",
			autoHideDelay: 500,
			autoHideSuspend: false,
		},
	});
	element.dataset.scrollbarInitialized = "true";
}

const observer =
	typeof IntersectionObserver === "undefined"
		? null
		: new IntersectionObserver(
				(entries, currentObserver) => {
					for (const entry of entries) {
						if (!entry.isIntersecting) continue;
						void enhanceKaTeXDisplay(entry.target as HTMLElement);
						currentObserver.unobserve(entry.target);
					}
				},
				{ root: null, rootMargin: "100px", threshold: 0.1 },
			);

export function initKaTeXScrollbars(root: ParentNode = document): void {
	for (const element of root.querySelectorAll<HTMLElement>(".katex-display")) {
		if (
			element.dataset.scrollbarInitialized === "true" ||
			observed.has(element)
		) {
			continue;
		}
		observed.add(element);
		if (observer) observer.observe(element);
		else void enhanceKaTeXDisplay(element);
	}
}
