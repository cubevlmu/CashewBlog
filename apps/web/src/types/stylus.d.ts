/** stylus 包的最小类型面（构建期编译 Twikoo 内联样式用） */

declare module "stylus" {
	interface StylusRenderer {
		render(callback: (error: Error | null, css: string) => void): void;
	}

	function stylus(source: string): StylusRenderer;

	namespace stylus {
		export function render(
			source: string,
			callback: (error: Error | null, css: string) => void,
		): void;
		export function render(
			source: string,
			options: Record<string, unknown>,
			callback: (error: Error | null, css: string) => void,
		): void;
	}

	export default stylus;
}
