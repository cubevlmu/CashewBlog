export const ACFUN_VIDEO_ID_PATTERN = /^ac[1-9]\d*$/i;

import { getVideoPreload } from "./video-preload.mjs";

function getText(value) {
	return typeof value === "string" ? value.trim() : "";
}

/** Normalizes the only author-controlled fields accepted by the facade. */
export function getAcFunEmbedData(attributes = {}) {
	const rawAcid = getText(attributes.acid);
	const acid = rawAcid.toLowerCase();
	const title = getText(attributes.title);
	const preload = getVideoPreload(attributes.preload);
	if (!ACFUN_VIDEO_ID_PATTERN.test(acid) || !title || preload === null) {
		return null;
	}

	return { acid, title, preload };
}

/** Produces the sole provider URL permitted after an explicit user action. */
export function getAcFunPlayerUrl(acid) {
	const normalizedAcid = getText(acid).toLowerCase();
	if (!ACFUN_VIDEO_ID_PATTERN.test(normalizedAcid)) return null;

	return `https://www.acfun.cn/player/${normalizedAcid}`;
}
