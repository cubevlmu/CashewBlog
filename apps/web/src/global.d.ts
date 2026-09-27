import type Swup from "swup";
import "@swup/scroll-plugin";

declare global {
	interface OddmiscStatsResult {
		pageviews: number;
		visitors: number;
		visits: number;
		_fromCache?: boolean;
	}

	interface OddmiscBrowserClient {
		getSiteStats: () => Promise<OddmiscStatsResult>;
		getPageStats: (path: string) => Promise<OddmiscStatsResult>;
		clearCache: () => void;
	}

	interface Window {
		swup?: Swup;
		oddmisc?: OddmiscBrowserClient;
		__shironeUmamiStatsPromises?: Record<string, Promise<OddmiscStatsResult>>;
		__shironeNavigationBound?: boolean;
		__shironeSidebarBound?: boolean;
	}
}

