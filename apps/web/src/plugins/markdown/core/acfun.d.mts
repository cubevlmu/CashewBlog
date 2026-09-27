export const ACFUN_VIDEO_ID_PATTERN: RegExp;

export type AcFunEmbedData = {
	acid: string;
	title: string;
	preload: "none" | "auto";
};

export function getAcFunEmbedData(
	attributes?: Record<string, unknown>,
): AcFunEmbedData | null;

export function getAcFunPlayerUrl(acid: string): string | null;
