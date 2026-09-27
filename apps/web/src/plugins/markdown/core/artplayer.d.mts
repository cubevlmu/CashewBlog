export type ArtPlayerEmbedData = {
	src: string;
	title: string;
	preload: "none" | "auto";
};

export function getArtPlayerEmbedData(
	attributes?: Record<string, unknown>,
): ArtPlayerEmbedData | null;
