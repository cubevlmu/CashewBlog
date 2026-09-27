import { FANCYBOX_SELECTORS } from "./fancybox-config";

const RUNTIME_BOUND_KEY = "fancyboxRuntimeBound";

let cleanupFancybox: (() => void) | undefined;

function hasMatch(root: ParentNode, selector: string): boolean {
	if (root instanceof Element && root.matches(selector)) return true;
	return root.querySelector(selector) !== null;
}

function hasFancyboxTarget(root: ParentNode): boolean {
	return Object.values(FANCYBOX_SELECTORS).some((selector) =>
		hasMatch(root, selector),
	);
}

/**
 * Loads Fancybox only when the supplied page fragment has a lightbox target.
 * The images remain normal links when the optional enhancement cannot load.
 */
export async function initFancyboxRuntime(
	root: ParentNode = document,
): Promise<void> {
	if (typeof document === "undefined" || !hasFancyboxTarget(root)) return;

	try {
		const runtime = await import("./fancybox-handler");
		cleanupFancybox = runtime.cleanupFancybox;
		await runtime.initFancybox();
	} catch (error) {
		console.error("Failed to initialize Fancybox runtime", error);
	}
}

function bindSwupCleanup(): void {
	const bind = () => {
		if (!window.swup?.hooks) return;
		window.swup.hooks.on("visit:start", () => cleanupFancybox?.());
	};

	if (window.swup?.hooks) bind();
	else document.addEventListener("swup:enable", bind, { once: true });
}

/**
 * Installs the persistent-shell lifecycle for article covers, Markdown images,
 * and image grids. New encrypted content must call initFancyboxRuntime itself.
 */
export function bindFancyboxRuntime(): void {
	if (typeof document === "undefined") return;
	if (document.documentElement.dataset[RUNTIME_BOUND_KEY] === "true") return;
	document.documentElement.dataset[RUNTIME_BOUND_KEY] = "true";

	void initFancyboxRuntime();
	bindSwupCleanup();
	document.addEventListener("swup:content:replace", () => {
		queueMicrotask(() => {
			const container = document.getElementById("swup-container");
			void initFancyboxRuntime(container ?? document);
		});
	});
}
