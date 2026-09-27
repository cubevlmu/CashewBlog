const ROOT_SELECTOR = ".m3-option-group[data-option-group]";
const TAB_SELECTOR = ".m3-option-group__tab";
const PANEL_SELECTOR = ".m3-option-group__panel";
const TABLIST_SELECTOR = ".m3-option-group__tablist";
const STORAGE_PREFIX = "shirone:option-group:";

let listenersBound = false;

function tabs(root: HTMLElement): HTMLButtonElement[] {
	return Array.from(
		root.querySelectorAll<HTMLButtonElement>(
			`:scope > .m3-option-group__tablist > ${TAB_SELECTOR}`,
		),
	);
}

function panels(root: HTMLElement): HTMLElement[] {
	return Array.from(
		root.querySelectorAll<HTMLElement>(
			`:scope > .m3-option-group__panels > ${PANEL_SELECTOR}`,
		),
	);
}

function scrollTabWithinList(tab: HTMLButtonElement): void {
	const list = tab.closest<HTMLElement>(TABLIST_SELECTOR);
	if (!list) return;
	const listRect = list.getBoundingClientRect();
	const tabRect = tab.getBoundingClientRect();
	let delta = 0;
	if (tabRect.left < listRect.left) delta = tabRect.left - listRect.left;
	else if (tabRect.right > listRect.right)
		delta = tabRect.right - listRect.right;
	if (Math.abs(delta) < 1) return;
	list.scrollBy({
		left: delta,
		behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
			? "auto"
			: "smooth",
	});
}

function onWheel(event: WheelEvent): void {
	if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
		return;
	}

	const target = event.target;
	if (!(target instanceof Element)) return;
	const list = target.closest<HTMLElement>(TABLIST_SELECTOR);
	if (!list || list.scrollWidth <= list.clientWidth + 1) return;

	const delta =
		Math.abs(event.deltaX) > Math.abs(event.deltaY)
			? event.deltaX
			: event.deltaY;
	if (delta === 0) return;

	const maxScrollLeft = list.scrollWidth - list.clientWidth;
	const nextScrollLeft = Math.min(
		maxScrollLeft,
		Math.max(0, list.scrollLeft + delta),
	);
	list.scrollLeft = nextScrollLeft;
	event.preventDefault();
}

function readStoredValue(syncKey: string): string {
	if (!syncKey) return "";
	try {
		return localStorage.getItem(`${STORAGE_PREFIX}${syncKey}`) ?? "";
	} catch {
		return "";
	}
}

function storeValue(syncKey: string, value: string): void {
	if (!syncKey) return;
	try {
		localStorage.setItem(`${STORAGE_PREFIX}${syncKey}`, value);
	} catch {
		// Storage may be unavailable in privacy-restricted browsing contexts.
	}
}

function matchingIndex(root: HTMLElement, value: string): number {
	return tabs(root).findIndex((tab) => tab.dataset.optionValue === value);
}

function activate(
	root: HTMLElement,
	index: number,
	options: { focus?: boolean; persist?: boolean; synchronize?: boolean } = {},
): void {
	const tabItems = tabs(root);
	const panelItems = panels(root);
	if (
		index < 0 ||
		index >= tabItems.length ||
		tabItems.length !== panelItems.length
	) {
		return;
	}

	for (let itemIndex = 0; itemIndex < tabItems.length; itemIndex += 1) {
		const selected = itemIndex === index;
		const tab = tabItems[itemIndex];
		const panel = panelItems[itemIndex];
		tab.classList.toggle("m3-option-group__tab--active", selected);
		tab.setAttribute("aria-selected", String(selected));
		tab.tabIndex = selected ? 0 : -1;
		panel.classList.toggle("m3-option-group__panel--active", selected);
		panel.hidden = !selected;
	}

	const selectedTab = tabItems[index];
	const selectedValue = selectedTab.dataset.optionValue ?? "";
	root.dataset.activeValue = selectedValue;
	root.dataset.optionGroupReady = "true";

	if (options.focus) {
		selectedTab.focus({ preventScroll: true });
		scrollTabWithinList(selectedTab);
	}

	const syncKey = root.dataset.syncKey ?? "";
	if (options.persist) storeValue(syncKey, selectedValue);
	if (!options.synchronize || !syncKey || !selectedValue) return;

	for (const peer of document.querySelectorAll<HTMLElement>(ROOT_SELECTOR)) {
		if (peer === root || peer.dataset.syncKey !== syncKey) continue;
		const peerIndex = matchingIndex(peer, selectedValue);
		if (peerIndex >= 0) activate(peer, peerIndex);
	}
}

function initialize(root: HTMLElement): void {
	const tabItems = tabs(root);
	if (tabItems.length < 2 || tabItems.length !== panels(root).length) return;

	const storedValue = readStoredValue(root.dataset.syncKey ?? "");
	const storedIndex = storedValue ? matchingIndex(root, storedValue) : -1;
	const initialIndex = Number.parseInt(root.dataset.initialIndex ?? "0", 10);
	activate(
		root,
		storedIndex >= 0
			? storedIndex
			: Number.isInteger(initialIndex) && initialIndex >= 0
				? initialIndex
				: 0,
	);
}

function rootsWithin(container: ParentNode): HTMLElement[] {
	const roots = Array.from(
		container.querySelectorAll<HTMLElement>(ROOT_SELECTOR),
	);
	if (container instanceof HTMLElement && container.matches(ROOT_SELECTOR)) {
		roots.unshift(container);
	}
	return roots;
}

function onClick(event: MouseEvent): void {
	const target = event.target;
	if (!(target instanceof Element)) return;
	const tab = target.closest<HTMLButtonElement>(TAB_SELECTOR);
	const root = tab?.closest<HTMLElement>(ROOT_SELECTOR);
	if (!tab || !root) return;
	const index = tabs(root).indexOf(tab);
	activate(root, index, { persist: true, synchronize: true });
}

function onKeydown(event: KeyboardEvent): void {
	const target = event.target;
	if (!(target instanceof Element)) return;
	const tab = target.closest<HTMLButtonElement>(TAB_SELECTOR);
	const root = tab?.closest<HTMLElement>(ROOT_SELECTOR);
	if (!tab || !root) return;

	const tabItems = tabs(root);
	const currentIndex = tabItems.indexOf(tab);
	if (currentIndex < 0) return;

	const rtl = getComputedStyle(root).direction === "rtl";
	let nextIndex = -1;
	if (event.key === "Home") nextIndex = 0;
	else if (event.key === "End") nextIndex = tabItems.length - 1;
	else if (event.key === "ArrowRight") {
		nextIndex =
			(currentIndex + (rtl ? -1 : 1) + tabItems.length) % tabItems.length;
	} else if (event.key === "ArrowLeft") {
		nextIndex =
			(currentIndex + (rtl ? 1 : -1) + tabItems.length) % tabItems.length;
	}
	if (nextIndex < 0) return;

	event.preventDefault();
	activate(root, nextIndex, {
		focus: true,
		persist: true,
		synchronize: true,
	});
}

export function initOptionGroups(container: ParentNode = document): void {
	if (typeof document === "undefined") return;
	for (const root of rootsWithin(container)) initialize(root);

	if (listenersBound) return;
	listenersBound = true;
	document.addEventListener("click", onClick);
	document.addEventListener("keydown", onKeydown);
	document.addEventListener("wheel", onWheel, { passive: false });
}
