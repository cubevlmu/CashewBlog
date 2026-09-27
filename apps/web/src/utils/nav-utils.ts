import type { NavBarLink } from "@/types/navBarConfig";

/**
 * Navigation highlighting. Each rendered link carries a `navKey`: the preset
 * page key for system routes (home/archive/…), otherwise its normalised
 * internal path (custom pages). The current URL resolves to the set of keys it
 * satisfies, so both kinds highlight with the same comparison.
 */

/** `/links/friends/?x#y` → `/links/friends`; external or empty URLs → "". */
export function normalizeNavPath(path: string | undefined): string {
	if (!path?.startsWith("/")) return "";
	const pathname = path.split(/[?#]/)[0] ?? "";
	let decoded = pathname;
	try {
		decoded = decodeURI(pathname);
	} catch {
		// keep the raw path when it is not valid percent-encoding
	}
	return decoded.replace(/\/+$/, "") || "/";
}

export function navKeyForLink(link: Pick<NavBarLink, "pageKey" | "url" | "external">): string {
	if (link.pageKey) return link.pageKey;
	return link.external ? "" : normalizeNavPath(link.url);
}

/**
 * Current URL → preset page key. Category/tag filters win over the archive
 * page they are rendered on; unmatched routes return "".
 */
export function resolvePageKey(url: Pick<URL, "pathname" | "searchParams">): string {
	const pathname = normalizeNavPath(url.pathname);
	if (pathname === "/" || pathname.startsWith("/page/")) return "home";
	if (url.searchParams.has("category") || url.searchParams.has("uncategorized"))
		return "categories";
	if (url.searchParams.has("tag")) return "tags";
	if (pathname === "/archive") return "archive";
	if (pathname === "/categories") return "categories";
	if (pathname === "/tags") return "tags";
	if (pathname === "/series" || pathname.startsWith("/series/")) return "series";
	if (pathname === "/rss") return "rss";
	return "";
}

/** Every navKey the given URL activates. */
export function resolveNavKeys(url: Pick<URL, "pathname" | "searchParams">): string[] {
	return [resolvePageKey(url), normalizeNavPath(url.pathname)].filter(Boolean);
}
