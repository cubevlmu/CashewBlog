const MARK_VARIANTS = new Set([
	"primary",
	"secondary",
	"tertiary",
	"error",
	"tip",
]);
const FENCE_OPENER = /^[\t ]{0,3}(`{3,}|~{3,})/;
const VARIANT_SUFFIX = /^\{\.([a-z]+)\}/i;

function isEscaped(source, index) {
	let backslashCount = 0;
	for (
		let cursor = index - 1;
		cursor >= 0 && source[cursor] === "\\";
		cursor -= 1
	) {
		backslashCount += 1;
	}
	return backslashCount % 2 === 1;
}

function rewriteLine(line) {
	let output = "";
	let cursor = 0;
	let codeDelimiter = "";

	while (cursor < line.length) {
		if (line[cursor] === "`") {
			const delimiter = line.slice(cursor).match(/^`+/)?.[0] ?? "`";
			if (!codeDelimiter) {
				codeDelimiter = delimiter;
			} else if (delimiter.length === codeDelimiter.length) {
				codeDelimiter = "";
			}
			output += delimiter;
			cursor += delimiter.length;
			continue;
		}

		if (
			codeDelimiter ||
			line.slice(cursor, cursor + 2) !== "==" ||
			line[cursor - 1] === "=" ||
			line[cursor + 2] === "=" ||
			isEscaped(line, cursor)
		) {
			output += line[cursor];
			cursor += 1;
			continue;
		}

		const closingIndex = line.indexOf("==", cursor + 2);
		if (
			closingIndex === -1 ||
			line[closingIndex + 2] === "=" ||
			isEscaped(line, closingIndex)
		) {
			output += line[cursor];
			cursor += 1;
			continue;
		}

		const content = line.slice(cursor + 2, closingIndex);
		if (!content.trim() || content.includes("[") || content.includes("]")) {
			output += line[cursor];
			cursor += 1;
			continue;
		}

		const suffix = line.slice(closingIndex + 2).match(VARIANT_SUFFIX);
		const candidate = suffix?.[1]?.toLowerCase();
		if (candidate && !MARK_VARIANTS.has(candidate)) {
			output += line.slice(cursor, closingIndex + 2 + suffix[0].length);
			cursor = closingIndex + 2 + suffix[0].length;
			continue;
		}

		const variant = candidate ?? "primary";
		const suffixLength = suffix?.[0].length ?? 0;

		output += `:m3-mark[${content}]{variant="${variant}"}`;
		cursor = closingIndex + 2 + suffixLength;
	}

	return output;
}

/**
 * Rewrites marker syntax into a text directive before remark-directive parses it.
 * Fenced and inline code remain author-controlled literal text.
 */
export function rewriteMarkerSyntax(source) {
	if (typeof source !== "string" || !source.includes("==")) return source;

	let fence = null;
	return source
		.split(/(\r?\n)/)
		.map((part) => {
			if (part === "\n" || part === "\r\n") return part;

			const fenceMatch = part.match(FENCE_OPENER);
			if (fenceMatch) {
				const marker = fenceMatch[1];
				if (!fence) {
					fence = { character: marker[0], length: marker.length };
				} else if (
					marker[0] === fence.character &&
					marker.length >= fence.length &&
					new RegExp(
						`^[\\t ]{0,3}${fence.character}{${fence.length},}[\\t ]*$`,
					).test(part)
				) {
					fence = null;
				}
				return part;
			}

			return fence ? part : rewriteLine(part);
		})
		.join("");
}

export function remarkMarker() {
	const parser = this.parser;
	if (typeof parser !== "function") {
		throw new TypeError(
			"remarkMarker requires an initialized Markdown parser.",
		);
	}

	this.parser = function parseMarker(source) {
		return parser(rewriteMarkerSyntax(source));
	};
}
