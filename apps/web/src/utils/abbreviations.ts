/**
 * Abbreviation tooltip enhancement.
 *
 * The remark output is SSR-native: each defined term is an <abbr class="m3-abbreviation">
 * (readable inline text) with an `anchor-name`, and a sibling native Popover
 * (`<span popover="manual" role="tooltip">`) is emitted at the article root and
 * positioned to the abbreviation via CSS Anchor Positioning (`position-anchor`).
 * A shown popover lives in the top layer, so it is never clipped by the article
 * column or sidebar overflow contexts.
 *
 * This module only wires the interaction: desktop hover (with a short delay),
 * keyboard focus, and tap on touch — the popover is shown/hidden through the
 * native Popover API and hidden again on Escape or an outside pointerdown.
 * Pure-SSR stays fully readable without JavaScript.
 */

const ABBREVIATION_SELECTOR =
	"abbr.m3-abbreviation[data-abbreviation-expansion]";
const HOVER_DELAY_MS = 300;
const TOUCH_DISMISS_MS = 2500;

function popoverFor(abbr: HTMLElement): HTMLElement | null {
	const id = abbr.getAttribute("aria-describedby");
	if (!id) return null;
	return document.getElementById(id);
}

function isOpen(abbr: HTMLElement): boolean {
	const popover = popoverFor(abbr);
	return popover?.matches(":popover-open") ?? false;
}

function close(abbr: HTMLElement): void {
	const popover = popoverFor(abbr);
	if (!popover) return;
	try {
		popover.hidePopover();
	} catch {
		// Already hidden; hidePopover() throws on a closed manual popover.
	}
}

function open(abbr: HTMLElement): void {
	const popover = popoverFor(abbr);
	if (!popover) {
		return;
	}
	// Keep at most one abbreviation tooltip open at a time.
	document
		.querySelectorAll<HTMLElement>(ABBREVIATION_SELECTOR)
		.forEach((other) => {
			if (other !== abbr) close(other);
		});
	if (popover.matches(":popover-open")) return;
	try {
		popover.showPopover();
	} catch {
		// Popover already shown or unsupported; safe to ignore.
	}
}

let listenersBound = false;

function bindDocumentListeners(): void {
	if (listenersBound) return;
	listenersBound = true;

	document.addEventListener("keydown", (event) => {
		if (event.key !== "Escape") return;
		document
			.querySelectorAll<HTMLElement>(ABBREVIATION_SELECTOR)
			.forEach(close);
	});

	// Light dismiss when tapping/clicking outside any abbreviation and its popover.
	document.addEventListener("pointerdown", (event) => {
		const target = event.target;
		if (!(target instanceof Element)) return;
		if (target.closest(ABBREVIATION_SELECTOR)) return;
		document
			.querySelectorAll<HTMLElement>(ABBREVIATION_SELECTOR)
			.forEach(close);
	});
}

const boundAbbreviations = new WeakSet<HTMLElement>();

function wire(abbr: HTMLElement): void {
	if (boundAbbreviations.has(abbr)) return;
	boundAbbreviations.add(abbr);

	let hoverTimer: ReturnType<typeof setTimeout> | null = null;
	let touchDismissTimer: ReturnType<typeof setTimeout> | null = null;

	abbr.addEventListener("mouseenter", () => {
		if (hoverTimer) clearTimeout(hoverTimer);
		hoverTimer = setTimeout(() => open(abbr), HOVER_DELAY_MS);
	});
	abbr.addEventListener("mouseleave", () => {
		if (hoverTimer) clearTimeout(hoverTimer);
		hoverTimer = null;
		close(abbr);
	});
	abbr.addEventListener("focusin", () => {
		if (hoverTimer) clearTimeout(hoverTimer);
		open(abbr);
	});
	abbr.addEventListener("focusout", () => close(abbr));

	abbr.addEventListener("pointerdown", (event) => {
		if (event.pointerType !== "touch") return;
		if (touchDismissTimer) clearTimeout(touchDismissTimer);
		touchDismissTimer = null;
		if (isOpen(abbr)) {
			close(abbr);
			return;
		}
		open(abbr);
		touchDismissTimer = setTimeout(() => close(abbr), TOUCH_DISMISS_MS);
	});
}

/**
 * Wires hover/focus/touch interaction for abbreviation popovers inside `container`.
 * Safe to call repeatedly (rebinding is guarded); call again after Swup replaces
 * content or after a protected post is decrypted.
 */
export function initAbbreviations(container: ParentNode = document): void {
	if (typeof document === "undefined") return;
	bindDocumentListeners();
	container.querySelectorAll<HTMLElement>(ABBREVIATION_SELECTOR).forEach(wire);
}
