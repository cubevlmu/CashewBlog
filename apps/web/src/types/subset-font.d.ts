/** subset-font 包的最小类型面（构建期字体子集化用，上游未随包提供类型） */

declare module "subset-font" {
	interface SubsetFontOptions {
		targetFormat?: "woff2" | "woff" | "truetype" | "sfnt";
		[key: string]: unknown;
	}

	function subsetFont(
		buffer: Buffer | Uint8Array,
		text: string,
		options?: SubsetFontOptions,
	): Promise<Buffer>;

	export default subsetFont;
}
