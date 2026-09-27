import { prefersReducedMotion } from "./motion";

export type BannerAnimationPreset =
	| "ken-burns"
	| "zoom-in"
	| "zoom-out"
	| "pan-left"
	| "pan-right"
	| "none";

export interface KeyframePair {
	from: string;
	to: string;
}

/**
 * 镜头运镜关键帧预设库（Ken Burns 动画预设）
 */
export const BANNER_KEYFRAME_PRESETS: Record<string, KeyframePair> = {
	"zoom-in": {
		from: "scale(1.02)",
		to: "scale(1.10)",
	},
	"zoom-out": {
		from: "scale(1.10)",
		to: "scale(1.02)",
	},
	"pan-left": {
		from: "scale(1.06) translate(1.5%, 0)",
		to: "scale(1.06) translate(-1.5%, 0)",
	},
	"pan-right": {
		from: "scale(1.06) translate(-1.5%, 0)",
		to: "scale(1.06) translate(1.5%, 0)",
	},
};

const KEN_BURNS_SEQUENCE = [
	"zoom-in",
	"pan-right",
	"zoom-out",
	"pan-left",
] as const;

export interface PlayBannerAnimationOptions {
	element: HTMLElement;
	preset?: BannerAnimationPreset;
	index?: number;
	durationMs: number;
}

export interface BannerAnimationHandle {
	animation: Animation | null;
	cancel: () => void;
	pause: () => void;
	resume: () => void;
}

/**
 * 针对 Banner 图层启动 Ken Burns / 运镜呼吸动画
 */
export function playBannerMotion(
	options: PlayBannerAnimationOptions,
): BannerAnimationHandle {
	const { element, preset = "ken-burns", index = 0, durationMs } = options;

	if (prefersReducedMotion() || preset === "none") {
		element.style.transform = "none";
		return {
			animation: null,
			cancel: () => {
				element.style.transform = "none";
			},
			pause: () => {},
			resume: () => {},
		};
	}

	let targetPresetName: string = preset;
	if (preset === "ken-burns") {
		targetPresetName =
			KEN_BURNS_SEQUENCE[Math.abs(index) % KEN_BURNS_SEQUENCE.length];
	}

	const keyframe =
		BANNER_KEYFRAME_PRESETS[targetPresetName] ||
		BANNER_KEYFRAME_PRESETS["zoom-in"];

	const anim = element.animate(
		[{ transform: keyframe.from }, { transform: keyframe.to }],
		{
			duration: durationMs,
			easing: "ease-out",
			fill: "forwards",
		},
	);

	return {
		animation: anim,
		cancel: () => {
			anim.cancel();
			element.style.transform = "none";
		},
		pause: () => {
			if (anim.playState === "running") anim.pause();
		},
		resume: () => {
			if (anim.playState === "paused") anim.play();
		},
	};
}
