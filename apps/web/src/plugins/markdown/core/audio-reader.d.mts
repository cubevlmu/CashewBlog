export type AudioReaderEmbedData = {
	src: string;
	title: string;
};

export function getAudioReaderEmbedData(
	attributes?: Record<string, unknown>,
	label?: string,
): AudioReaderEmbedData | null;
