/**
 * Tonal Bloom 工具函数：根据配置计算并输出内联 CSS 变量与占位参数。
 */
import { imageBloomConfig } from "@/config/imageBloomConfig";
import type { ImageBloomConfig } from "@/types/imageBloomConfig";

export function getBloomInlineVars(
	options?: Partial<ImageBloomConfig>,
): string {
	const opts = { ...imageBloomConfig, ...options };
	if (!opts.enable) return "";
	return [
		`--image-bloom-blur: ${opts.blurRadius ?? 20}px`,
		`--image-bloom-opacity: ${opts.opacity ?? 0.7}`,
		`--image-bloom-duration: ${opts.transitionDuration ?? 300}ms`,
	].join("; ");
}
