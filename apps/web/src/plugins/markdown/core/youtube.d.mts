export const YOUTUBE_VIDEO_ID_PATTERN: RegExp;

export type YouTubeEmbedData = {
	id: string;
	title: string;
	preload: "none" | "auto";
};

export function getYouTubeEmbedData(
	attributes?: Record<string, unknown>,
): YouTubeEmbedData | null;

export function getYouTubePlayerUrl(id: string): string | null;
