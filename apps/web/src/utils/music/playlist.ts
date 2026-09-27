import type { PlaybackMode } from "@/types/musicConfig";

export function nextTrackIndex(
	currentIndex: number,
	length: number,
	mode: PlaybackMode,
	random: () => number = Math.random,
): number {
	if (length <= 0) return -1;
	if (length === 1 || mode === "repeat-one") return Math.max(0, currentIndex);
	if (mode !== "shuffle") return (Math.max(0, currentIndex) + 1) % length;

	const offset = 1 + Math.floor(random() * (length - 1));
	return (Math.max(0, currentIndex) + offset) % length;
}

export function previousTrackIndex(
	currentIndex: number,
	length: number,
	mode: PlaybackMode,
	random: () => number = Math.random,
): number {
	if (length <= 0) return -1;
	if (length === 1 || mode === "repeat-one") return Math.max(0, currentIndex);
	if (mode === "shuffle") {
		return nextTrackIndex(currentIndex, length, mode, random);
	}
	return (Math.max(0, currentIndex) - 1 + length) % length;
}
