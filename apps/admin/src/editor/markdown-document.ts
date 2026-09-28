// Splits Markdown into editor blocks and joins them back. Every block keeps its exact
// source, so blocks the author never touches serialize byte for byte; only edited blocks
// are re-serialized from their structured model (see markdown-blocks.ts).

import { parseInline } from "./inline-markdown";
import {
  isTableStart,
  parseCode,
  parseHeading,
  parseImage,
  parseList,
  parseQuote,
  parseTable,
  type ListModel,
} from "./markdown-blocks";

export type BlockKind =
  | "paragraph"
  | "heading"
  | "blockquote"
  | "list"
  | "code"
  | "table"
  | "image"
  | "thematic-break"
  | "raw";

export interface MarkdownBlock {
  id: string;
  kind: BlockKind;
  source: string;
}

export interface MarkdownDocument {
  blocks: MarkdownBlock[];
}

export interface ParseResult {
  document: MarkdownDocument;
  failed: boolean;
}

let sequence = 0;
export function createBlock(kind: BlockKind, source = ""): MarkdownBlock {
  return { id: `b${++sequence}`, kind, source };
}

const BLANK = /^\s*$/;
const FENCE = /^ {0,3}(`{3,}(?!.*`)|~{3,})/;
const MATH = /^ {0,3}\$\$/;
// remark-directive openers plus the site's Plume-style spaced form (`::: note`).
const CONTAINER_OPEN = /^ {0,3}:{3,}[ \t]*[a-zA-Z]/;
const CONTAINER_CLOSE = /^ {0,3}:{3,}\s*$/;
const LEAF_DIRECTIVE = /^ {0,3}::[a-zA-Z]/;
const HTML_BLOCK =
  /^ {0,3}(?:<!--|<\?|<![A-Za-z]|<!\[CDATA\[|<\/?(?:address|article|aside|audio|blockquote|center|details|dialog|dd|div|dl|dt|figcaption|figure|footer|form|h[1-6]|header|hr|iframe|li|main|nav|ol|p|picture|pre|script|section|source|style|summary|table|tbody|td|textarea|tfoot|th|thead|tr|ul|video)(?:\s|\/?>|$))/i;
const HTML_TAG_LINE = /^ {0,3}<\/?[a-zA-Z][\w-]*(?:\s[^<>]*)?\/?>\s*$/;
const HEADING = /^ {0,3}#{1,6}(?:[ \t]|$)/;
const RULE = /^ {0,3}([-*_])(?:[ \t]*\1){2,}[ \t]*$/;
const SETEXT = /^ {0,3}(?:=+|-+)[ \t]*$/;
const QUOTE = /^ {0,3}>/;
const LIST = /^ {0,3}(?:[-+*]|\d{1,9}[.)])(?:[ \t]|$)/;
const INDENTED = /^(?: {4}|\t)/;
const DEFINITION = /^ {0,3}\[[^\]]+\]:/;

/** Lines that end a paragraph without a blank line in between. */
function interrupts(line: string) {
  return (
    FENCE.test(line) ||
    MATH.test(line) ||
    CONTAINER_OPEN.test(line) ||
    LEAF_DIRECTIVE.test(line) ||
    HTML_BLOCK.test(line) ||
    HEADING.test(line) ||
    RULE.test(line) ||
    QUOTE.test(line) ||
    /^ {0,3}(?:[-+*]|1[.)])[ \t]+\S/.test(line)
  );
}

function fenceEnd(lines: string[], start: number): number {
  const fence = lines[start].match(FENCE)![1];
  const close = new RegExp(`^ {0,3}${fence[0] === "`" ? "`" : "~"}{${fence.length},}\\s*$`);
  for (let index = start + 1; index < lines.length; index++) if (close.test(lines[index])) return index;
  return -1;
}

/** `-`, `*`, `+`, `.` or `)` — what distinguishes one list from the next. */
function listMarker(line: string) {
  return line.trimStart().match(/^(?:([-+*])|\d+([.)]))/)?.slice(1).find(Boolean) ?? "";
}

interface Region {
  kind: BlockKind;
  start: number;
  end: number;
}

function scan(lines: string[]): Region[] {
  const regions: Region[] = [];
  let index = 0;
  const untilBlank = (from: number) => {
    let end = from;
    while (end + 1 < lines.length && !BLANK.test(lines[end + 1])) end++;
    return end;
  };
  while (index < lines.length) {
    const line = lines[index];
    if (BLANK.test(line)) {
      index++;
      continue;
    }
    const start = index;
    let kind: BlockKind = "paragraph";
    let end = start;

    if (FENCE.test(line)) {
      const close = fenceEnd(lines, start);
      kind = close < 0 ? "raw" : "code";
      end = close < 0 ? lines.length - 1 : close;
    } else if (MATH.test(line)) {
      kind = "raw";
      if (!/^\s*\$\$.+\$\$\s*$/.test(line)) {
        end = lines.findIndex((value, at) => at > start && /\$\$\s*$/.test(value));
        if (end < 0) end = lines.length - 1;
      }
    } else if (CONTAINER_OPEN.test(line)) {
      kind = "raw";
      let depth = 1;
      end = start + 1;
      for (; end < lines.length; end++) {
        if (FENCE.test(lines[end])) {
          const close = fenceEnd(lines, end);
          end = close < 0 ? lines.length - 1 : close;
        } else if (CONTAINER_OPEN.test(lines[end])) depth++;
        else if (CONTAINER_CLOSE.test(lines[end]) && --depth === 0) break;
      }
      end = Math.min(end, lines.length - 1);
    } else if (LEAF_DIRECTIVE.test(line)) {
      kind = "raw";
    } else if (HTML_BLOCK.test(line) || HTML_TAG_LINE.test(line)) {
      kind = "raw";
      if (/^ {0,3}<!--/.test(line)) {
        end = lines.findIndex((value, at) => at >= start && value.includes("-->"));
        if (end < 0) end = lines.length - 1;
        end = Math.max(end, untilBlank(end));
      } else end = untilBlank(start);
    } else if (HEADING.test(line)) {
      kind = "heading";
    } else if (RULE.test(line)) {
      kind = "thematic-break";
    } else if (isTableStart(line, lines[start + 1])) {
      kind = "table";
      end = untilBlank(start);
    } else if (QUOTE.test(line)) {
      kind = "blockquote";
      while (end + 1 < lines.length) {
        const next = lines[end + 1];
        if (BLANK.test(next) || (!QUOTE.test(next) && interrupts(next))) break;
        end++;
      }
    } else if (LIST.test(line)) {
      kind = "list";
      // A top-level item with another bullet character or ordered delimiter starts a new list.
      const marker = listMarker(line);
      const indent = line.length - line.trimStart().length;
      let at = start + 1;
      while (at < lines.length) {
        const next = lines[at];
        if (LIST.test(next) && next.length - next.trimStart().length <= indent && listMarker(next) !== marker) break;
        if (BLANK.test(next)) {
          let ahead = at;
          while (ahead < lines.length && BLANK.test(lines[ahead])) ahead++;
          if (ahead < lines.length && !RULE.test(lines[ahead]) && (LIST.test(lines[ahead]) || /^\s{2,}\S/.test(lines[ahead]))) {
            at = ahead;
            continue;
          }
          break;
        }
        if (RULE.test(next) && !/^\s/.test(next)) break;
        if (LIST.test(next) || /^\s+\S/.test(next) || !interrupts(next)) {
          end = at;
          at++;
          continue;
        }
        break;
      }
    } else if (INDENTED.test(line)) {
      kind = "raw";
      let at = start + 1;
      while (at < lines.length && (BLANK.test(lines[at]) || INDENTED.test(lines[at]))) {
        if (!BLANK.test(lines[at])) end = at;
        at++;
      }
    } else if (DEFINITION.test(line)) {
      kind = "raw";
      end = untilBlank(start);
      // Footnote definitions may continue with indented paragraphs.
      let at = end + 1;
      while (at < lines.length) {
        let ahead = at;
        while (ahead < lines.length && BLANK.test(lines[ahead])) ahead++;
        if (ahead >= lines.length || !INDENTED.test(lines[ahead])) break;
        end = untilBlank(ahead);
        at = end + 1;
      }
    } else {
      while (end + 1 < lines.length) {
        const next = lines[end + 1];
        if (BLANK.test(next)) break;
        if (SETEXT.test(next)) {
          kind = "heading";
          end++;
          break;
        }
        if (interrupts(next)) break;
        end++;
      }
    }
    regions.push({ kind, start, end });
    index = end + 1;
  }
  return regions;
}

function classify(kind: BlockKind, source: string): MarkdownBlock {
  const editable =
    kind === "code"
      ? parseCode(source)
      : kind === "heading"
        ? parseHeading(source)
        : kind === "table"
          ? parseTable(source)
          : kind === "blockquote"
            ? parseQuote(source)
            : kind === "list"
              ? parseList(source)
              : true;
  if (!editable) return createBlock("raw", source);
  if (kind === "paragraph" && parseImage(source)) return createBlock("image", source);
  return createBlock(kind, source);
}

export function parseMarkdown(source: string): ParseResult {
  const normalized = source.replace(/\r\n?/g, "\n");
  if (!normalized.trim()) return { document: { blocks: [] }, failed: false };
  try {
    const lines = normalized.split("\n");
    const blocks = scan(lines).map((region) =>
      classify(region.kind, lines.slice(region.start, region.end + 1).join("\n").replace(/\s+$/, "")),
    );
    return { document: { blocks }, failed: false };
  } catch {
    return { document: { blocks: [createBlock("raw", normalized)] }, failed: true };
  }
}

export function serializeMarkdown(document: MarkdownDocument): string {
  return document.blocks
    .map((block) => block.source)
    .filter((source) => source.trim())
    .join("\n\n");
}

/** Plain text of inline Markdown without syntax; images, HTML and other atoms are dropped. */
function readableText(inline: string) {
  return parseInline(inline)
    .map((run) => (run.type === "text" ? run.text : run.type === "break" ? " " : ""))
    .join("");
}
function listText(list: ListModel): string[] {
  return list.items.flatMap((item) => [readableText(item.text), ...(item.children ? listText(item.children) : [])]);
}

/** Summary text from the prose of a post: paragraphs, quotes and list items, in order. */
export function markdownExcerpt(markdown: string, limit = 240): string {
  const parts: string[] = [];
  let length = 0;
  for (const block of parseMarkdown(markdown).document.blocks) {
    const texts =
      block.kind === "paragraph"
        ? [readableText(block.source)]
        : block.kind === "blockquote"
          ? (parseQuote(block.source) ?? []).map(readableText)
          : block.kind === "list"
            ? listText(parseList(block.source) ?? { ordered: false, start: 1, marker: "-", loose: false, items: [] })
            : [];
    for (const text of texts.map((value) => value.replace(/\s+/g, " ").trim()).filter(Boolean)) {
      parts.push(text);
      length += text.length + 1;
    }
    if (length >= limit) break;
  }
  return parts.join(" ").slice(0, limit).trim();
}

/** Short human-readable label for a raw block. */
export function rawLabel(source: string): string {
  const first = source.split("\n", 1)[0].trim();
  const name = first.match(/^:{2,}[ \t]*([a-zA-Z][\w-]*)/)?.[1];
  if (/^:{3,}/.test(first) && name) return `扩展容器 · ${name}`;
  if (name) return `扩展组件 · ${name}`;
  if (first.startsWith("$$")) return "数学公式";
  if (/^(`{3,}|~{3,})/.test(first)) return "未闭合的代码块";
  if (first.startsWith("<")) return "HTML";
  const callout = first.match(/^>\s*\[!(\w+)\]/)?.[1];
  if (callout) return `提示框 · ${callout.toLowerCase()}`;
  if (first.startsWith(">")) return "复杂引用";
  if (/^\[\^/.test(first)) return "脚注";
  if (/^\[[^\]]+\]:/.test(first)) return "链接定义";
  if (/^(?:[-+*]|\d+[.)])(?:\s|$)/.test(first)) return "复杂列表";
  if (/^(?: {4}|\t)/.test(source)) return "缩进代码";
  return "Markdown 源码";
}
