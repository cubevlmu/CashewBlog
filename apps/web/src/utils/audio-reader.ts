const AUDIO_READER_SELECTOR = "[data-audio-reader]";
const boundReaders = new WeakSet<HTMLElement>();

function setState(
	reader: HTMLElement,
	toggle: HTMLButtonElement,
	state: "paused" | "playing" | "error",
): void {
	reader.dataset.audioReaderState = state;
	toggle.setAttribute("aria-pressed", String(state === "playing"));
}

function wire(reader: HTMLElement): void {
	if (boundReaders.has(reader)) return;
	const audio = reader.querySelector<HTMLAudioElement>(
		"[data-audio-reader-media]",
	);
	const toggle = reader.querySelector<HTMLButtonElement>(
		"[data-audio-reader-toggle]",
	);
	if (!audio || !toggle) return;
	boundReaders.add(reader);

	audio.addEventListener("play", () => setState(reader, toggle, "playing"));
	audio.addEventListener("pause", () => setState(reader, toggle, "paused"));
	audio.addEventListener("ended", () => setState(reader, toggle, "paused"));
	audio.addEventListener("error", () => setState(reader, toggle, "error"));
	const togglePlayback = () => {
		if (audio.paused) {
			void audio.play().catch(() => setState(reader, toggle, "error"));
			return;
		}
		audio.pause();
	};
	toggle.addEventListener("click", () => {
		togglePlayback();
	});
}

/** Adds idempotent playback controls to compact audio reader markup. */
export function initAudioReaders(container: ParentNode = document): void {
	if (typeof document === "undefined") return;
	container.querySelectorAll<HTMLElement>(AUDIO_READER_SELECTOR).forEach(wire);
}
