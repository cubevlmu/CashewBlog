export function pathsEqual(path1: string, path2: string): boolean {
	const normalizedPath1 = path1.replace(/^\/|\/$/g, "").toLowerCase();
	const normalizedPath2 = path2.replace(/^\/|\/$/g, "").toLowerCase();
	return normalizedPath1 === normalizedPath2;
}

function joinUrl(...parts: string[]): string {
	const joined = parts.join("/");
	return joined.replace(/\/+/g, "/");
}

export function getPostUrlBySlug(slug: string): string {
	const trimmed = slug.replace(/^\/+|\/+$/g, "");
	return url(`/posts/${encodeURIComponent(trimmed)}/`);
}

/** Archive view filtered by tag slug. */
export function getTagUrl(slug: string): string {
	if (!slug) return url("/archive/");
	return url(`/archive/?tag=${encodeURIComponent(slug)}`);
}

/** Archive view filtered by category slug; `null` lists uncategorized posts. */
export function getCategoryUrl(slug: string | null): string {
	if (!slug) return url("/archive/?uncategorized=true");
	return url(`/archive/?category=${encodeURIComponent(slug)}`);
}

export function getSeriesUrl(series: string): string {
	if (!series?.trim()) return url("/series/");
	return url(`/series/${encodeURIComponent(series.trim())}/`);
}

export function getDir(path: string): string {
	const lastSlashIndex = path.lastIndexOf("/");
	if (lastSlashIndex < 0) {
		return "/";
	}
	return path.substring(0, lastSlashIndex + 1);
}

export function url(path: string, baseUrlOverride?: string): string {
	if (!path) {
		return baseUrlOverride ?? import.meta.env?.BASE_URL ?? "/";
	}
	if (
		path.startsWith("http://") ||
		path.startsWith("https://") ||
		path.startsWith("data:") ||
		path.startsWith("#") ||
		path.startsWith("mailto:") ||
		path.startsWith("tel:") ||
		path.startsWith("javascript:")
	) {
		return path;
	}
	const baseUrl = baseUrlOverride ?? import.meta.env?.BASE_URL ?? "/";
	const normalizedBase = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
	const normalizedPath = path.startsWith("/") ? path : `/${path}`;

	if (
		normalizedBase !== "/" &&
		(normalizedPath === baseUrl || normalizedPath.startsWith(normalizedBase))
	) {
		return normalizedPath;
	}
	return joinUrl("", baseUrl, path);
}

/**
 * 将相对路径或绝对路径解析为完整的绝对 URL（附带域名与 base 路径）。
 * 针对已包含协议的外部 URL 或 Data URL 原样返回；
 * 若未提供 baseOrigin 则回退为带 base 的相对路径。
 */
export function toAbsoluteUrl(
	path: string,
	baseOrigin?: string | URL,
	baseUrlOverride?: string,
): string {
	if (!path) return "";
	if (
		path.startsWith("http://") ||
		path.startsWith("https://") ||
		path.startsWith("data:")
	) {
		return path;
	}
	const pathWithBase = url(path, baseUrlOverride);
	if (!baseOrigin) return pathWithBase;
	try {
		return new URL(pathWithBase, baseOrigin).href;
	} catch {
		return pathWithBase;
	}
}
