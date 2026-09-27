const VIDEO_PRELOAD_VALUES = new Set(["none", "auto"]);

export function getVideoPreload(value) {
	const preload = typeof value === "string" ? value.trim().toLowerCase() : "";
	if (!preload) return "none";
	return VIDEO_PRELOAD_VALUES.has(preload) ? preload : null;
}
