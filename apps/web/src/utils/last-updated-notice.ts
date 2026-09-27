import { resolveLastUpdatedNoticeState } from "./date-utils";

const SELECTOR = "[data-last-updated-notice]";
const BOUND_DATA_KEY = "lastUpdatedNoticeBound";

export function updateLastUpdatedNotices(
	root: ParentNode = document,
	reference: Date = new Date(),
): void {
	for (const notice of root.querySelectorAll<HTMLElement>(SELECTOR)) {
		const date = new Date(notice.dataset.lastUpdatedDate ?? "");
		const minimumAgeDays = Number(notice.dataset.minimumAgeDays);
		if (!Number.isFinite(date.getTime())) {
			notice.hidden = true;
			continue;
		}

		const state = resolveLastUpdatedNoticeState(
			date,
			minimumAgeDays,
			reference,
		);
		const days = notice.querySelector<HTMLElement>("[data-last-updated-days]");
		if (days) days.textContent = String(state.days);
		notice.hidden = !state.visible;
	}
}

export function initLastUpdatedNotices(): void {
	updateLastUpdatedNotices();
	if (document.documentElement.dataset[BOUND_DATA_KEY] === "true") return;

	document.documentElement.dataset[BOUND_DATA_KEY] = "true";
	document.addEventListener("swup:content:replace", () => {
		updateLastUpdatedNotices();
	});
}
