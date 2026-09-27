export const YOUTUBE_VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;

import { getVideoPreload } from "./video-preload.mjs";

function getText(value) {
	return typeof value === "string" ? value.trim() : "";
}

/** Normalizes the only author-controlled fields accepted by the facade. */
export function getYouTubeEmbedData(attributes = {}) {
	const id = getText(attributes.id);
	const title = getText(attributes.title);
	const preload = getVideoPreload(attributes.preload);
	if (!YOUTUBE_VIDEO_ID_PATTERN.test(id) || !title || preload === null) {
		return null;
	}

	return { id, title, preload };
}

/** Produces the sole provider URL permitted after an explicit user action. */
export function getYouTubePlayerUrl(id) {
	if (!YOUTUBE_VIDEO_ID_PATTERN.test(id)) return null;

	const url = new URL(`https://www.youtube-nocookie.com/embed/${id}`);
	url.searchParams.set("rel", "0");
	url.searchParams.set("modestbranding", "1");
	return url.toString();
}
