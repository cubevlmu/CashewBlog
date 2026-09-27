function getText(value) {
	return typeof value === "string" ? value.trim() : "";
}

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

/** Normalizes author-controlled fields for a compact audio reader. */
export function getAudioReaderEmbedData(attributes = {}, label = "") {
	const src = getSafeUrl(attributes.src);
	const title = getText(label);
	if (!src || !title) return null;

	return { src, title };
}
