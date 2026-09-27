/**
 * remark 源码预处理：转义文本中的数字比例冒号。
 *
 * `remark-directive` 会把 `3:4`、`16:9` 这类文本里的 `:4`、`:9` 误判为
 * Text Directive（包括出现在图片 alt 文本中的情况），导致内容解析中断或丢失。
 * 这里在 Markdown 解析前把「数字:数字」中的冒号替换为 `\:` 转义写法；
 * Markdown 渲染 `\:` 时正常输出 `:`，作者可见文本保持不变。
 *
 * 反引号包裹的行内代码与围栏代码块（``` / ~~~）不参与替换，原样保护。
 */

/** 匹配围栏代码块（``` / ~~~）与行内代码段；捕获组之外的片段才是普通文本 */
const CODE_SEGMENT_PATTERN =
	/(`{3,}[\s\S]*?`{3,}|~{3,}[\s\S]*?~{3,}|`+[^`\n]*`+)/g;

/** 仅匹配两侧均为数字的冒号（比例写法） */
const NUMERIC_COLON_PATTERN = /(?<=\d):(?=\d)/g;

/**
 * 对 Markdown 源码执行比例冒号转义。
 *
 * @param {string} source 原始 Markdown 源码。
 * @returns {string} 转义后的源码。
 */
export function escapeNumericColons(source) {
	return source
		.split(CODE_SEGMENT_PATTERN)
		.map((segment, index) =>
			// split 带捕获组时奇数下标为代码段，保持原样
			index % 2 === 0 ? segment.replace(NUMERIC_COLON_PATTERN, "\\:") : segment,
		)
		.join("");
}

/**
 * remark 插件：包装解析器，在解析前转义数字比例冒号。
 * 必须注册在 remark-parse 可用之后（remarkPlugins 列表内即可）。
 *
 * @this {import('unified').Processor}
 */
export function remarkEscapeNumericColons() {
	const parser = this.parser;

	if (typeof parser !== "function") {
		throw new TypeError(
			"remarkEscapeNumericColons 需要在 Markdown 解析器配置完成之后注册。",
		);
	}

	this.parser = function parseWithEscapedNumericColons(source) {
		return parser(escapeNumericColons(String(source)));
	};
}
