export const BILIBILI_BVID_PATTERN: RegExp;

export type BilibiliEmbedData = {
	bvid: string;
	title: string;
	part: number;
	preload: "none" | "auto";
};

export function getBilibiliEmbedData(
	attributes?: Record<string, unknown>,
): BilibiliEmbedData | null;

export function getBilibiliPlayerUrl(
	bvid: string,
	part: string | number,
): string | null;
