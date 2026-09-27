function getText(value) {
	return typeof value === "string" ? value.trim() : "";
}

import { getVideoPreload } from "./video-preload.mjs";

function getSafeUrl(value) {
	const url = getText(value);
	if (!url) return null;
	if (url.startsWith("/") && !url.startsWith("//")) return url;

	try {
		return new URL(url).protocol === "https:" ? url : null;
	} catch {
		return null;
	}
}

/** Normalizes the only author-controlled fields accepted by native video. */
export function getArtPlayerEmbedData(attributes = {}) {
	const src = getSafeUrl(attributes.src);
	const title = getText(attributes.title);
	const preload = getVideoPreload(attributes.preload);
	if (!src || !title || preload === null) return null;

	return { src, title, preload };
}
