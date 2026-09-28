// Pure block-level editor commands: type conversion, Markdown shortcut rules and the
// undo/redo history. The contenteditable layer maps user input onto these.

import { escapeText, inlineText } from "./inline-markdown";
import { createBlock, type MarkdownBlock } from "./markdown-document";
import {
  emptyList,
  emptyTable,
  serializeTable,
  parseCode,
  parseHeading,
  parseList,
  parseQuote,
  serializeCode,
  serializeHeading,
  serializeList,
  serializeQuote,
  textSource,
  type ListModel,
} from "./markdown-blocks";

export type BlockType =
  | "paragraph"
  | "h1"
  | "h2"
  | "h3"
  | "h4"
  | "h5"
  | "h6"
  | "blockquote"
  | "bullet"
  | "ordered"
  | "task"
  | "code";

export const BLOCK_TYPES: { value: BlockType; label: string; icon: string }[] = [
  { value: "paragraph", label: "正文", icon: "pi pi-align-left" },
  { value: "h1", label: "标题 1", icon: "pi pi-hashtag" },
  { value: "h2", label: "标题 2", icon: "pi pi-hashtag" },
  { value: "h3", label: "标题 3", icon: "pi pi-hashtag" },
  { value: "h4", label: "标题 4", icon: "pi pi-hashtag" },
  { value: "h5", label: "标题 5", icon: "pi pi-hashtag" },
  { value: "h6", label: "标题 6", icon: "pi pi-hashtag" },
  { value: "blockquote", label: "引用", icon: "pi pi-comment" },
  { value: "bullet", label: "无序列表", icon: "pi pi-list" },
  { value: "ordered", label: "有序列表", icon: "pi pi-sort-numeric-down" },
  { value: "task", label: "任务列表", icon: "pi pi-check-square" },
  { value: "code", label: "代码块", icon: "pi pi-code" },
];

export function blockType(block: MarkdownBlock | undefined): BlockType | null {
  if (!block) return null;
  if (block.kind === "paragraph") return "paragraph";
  if (block.kind === "heading") return `h${parseHeading(block.source)?.level ?? 1}` as BlockType;
  if (block.kind === "blockquote") return "blockquote";
  if (block.kind === "code") return "code";
  if (block.kind === "list") {
    const list = parseList(block.source);
    if (list?.items.some((item) => item.checked !== null)) return "task";
    return list?.ordered ? "ordered" : "bullet";
  }
  return null;
}

function flattenList(list: ListModel): string[] {
  return list.items.flatMap((item) => [item.text, ...(item.children ? flattenList(item.children) : [])]);
}

/** Inline Markdown lines carried over when a block changes type. */
function contentLines(block: MarkdownBlock): string[] {
  switch (block.kind) {
    case "paragraph":
      return block.source.split("\n");
    case "heading":
      return [parseHeading(block.source)?.text ?? ""];
    case "blockquote":
      return (parseQuote(block.source) ?? []).flatMap((paragraph) => paragraph.split("\n"));
    case "list": {
      const list = parseList(block.source);
      return list ? flattenList(list) : [block.source];
    }
    case "code":
      return (parseCode(block.source)?.code ?? "").split("\n").map((line) => escapeText(line));
    default:
      return [block.source];
  }
}

function retypeList(list: ListModel, type: BlockType): ListModel {
  const ordered = type === "ordered";
  return {
    ...list,
    ordered,
    marker: ordered ? (list.ordered ? list.marker : ".") : list.ordered ? "-" : list.marker,
    items: list.items.map((item) => ({
      ...item,
      checked: type === "task" ? (item.checked ?? false) : null,
    })),
  };
}

/** Converts a text-like block to another block type, keeping its content. */
export function convertBlock(block: MarkdownBlock, type: BlockType): MarkdownBlock {
  if (block.kind === "list" && (type === "bullet" || type === "ordered" || type === "task")) {
    const list = parseList(block.source);
    if (list) return createBlock("list", serializeList(retypeList(list, type)));
  }
  const lines = contentLines(block);
  const language = block.kind === "code" ? (parseCode(block.source)?.language ?? "") : "";
  switch (type) {
    case "paragraph":
      return createBlock("paragraph", textSource(lines.join("\n")));
    case "blockquote":
      return createBlock("blockquote", serializeQuote([lines.join("\n")]));
    case "bullet":
    case "ordered":
    case "task": {
      const list = emptyList(type === "ordered", type === "task");
      const texts = lines.filter((line) => line.trim());
      list.items = (texts.length ? texts : [""]).map((text) => ({ text, checked: type === "task" ? false : null, children: null }));
      return createBlock("list", serializeList(list));
    }
    case "code":
      return createBlock("code", serializeCode({ fence: "```", language, code: lines.map(inlineText).join("\n") }));
    default:
      return createBlock("heading", serializeHeading({ level: Number(type.slice(1)), text: lines.join(" ") }));
  }
}

/** Markdown shortcut typed at the start of a paragraph, e.g. `## ` or `- [ ] `. */
export function shortcutRule(text: string): { type: BlockType; length: number; start?: number } | null {
  const heading = text.match(/^(#{1,6}) /);
  if (heading) return { type: `h${heading[1].length}` as BlockType, length: heading[0].length };
  const task = text.match(/^(?:[-*+] )?\[[ xX]?\] /);
  if (task) return { type: "task", length: task[0].length };
  const bullet = text.match(/^[-*+] /);
  if (bullet) return { type: "bullet", length: bullet[0].length };
  const ordered = text.match(/^(\d{1,9})[.)] /);
  if (ordered) return { type: "ordered", length: ordered[0].length, start: Number(ordered[1]) };
  const quote = text.match(/^> /);
  if (quote) return { type: "blockquote", length: 2 };
  return null;
}

/** Whole-paragraph shortcuts completed with Enter: fences, rules and math blocks. */
export function enterRule(text: string): MarkdownBlock | null {
  const fence = text.match(/^(`{3,}|~{3,})([^`\s]*)$/);
  if (fence) return createBlock("code", serializeCode({ fence: fence[1], language: fence[2], code: "" }));
  if (/^(?:---|\*\*\*|___)$/.test(text)) return createBlock("thematic-break", "---");
  if (text === "$$") return createBlock("raw", "$$\n\n$$");
  return null;
}

export type MarkCommand = "bold" | "italic" | "strike" | "code";

export interface LinkValue {
  text: string;
  href: string;
  title: string;
}

export interface InsertItem {
  key: string;
  label: string;
  icon: string;
  keywords: string;
}

export const INSERT_ITEMS: InsertItem[] = [
  { key: "paragraph", label: "正文", icon: "pi pi-align-left", keywords: "text paragraph zhengwen" },
  { key: "h1", label: "标题 1", icon: "pi pi-hashtag", keywords: "heading h1 biaoti" },
  { key: "h2", label: "标题 2", icon: "pi pi-hashtag", keywords: "heading h2 biaoti" },
  { key: "h3", label: "标题 3", icon: "pi pi-hashtag", keywords: "heading h3 biaoti" },
  { key: "bullet", label: "无序列表", icon: "pi pi-list", keywords: "bullet list ul liebiao" },
  { key: "ordered", label: "有序列表", icon: "pi pi-sort-numeric-down", keywords: "ordered number list ol liebiao" },
  { key: "task", label: "任务列表", icon: "pi pi-check-square", keywords: "task todo checkbox renwu" },
  { key: "blockquote", label: "引用", icon: "pi pi-comment", keywords: "quote blockquote yinyong" },
  { key: "code", label: "代码块", icon: "pi pi-code", keywords: "code fence daima" },
  { key: "table", label: "表格", icon: "pi pi-table", keywords: "table biaoge" },
  { key: "image", label: "图片", icon: "pi pi-image", keywords: "image picture upload tupian" },
  { key: "file", label: "附件", icon: "pi pi-paperclip", keywords: "file attachment upload fujian" },
  { key: "rule", label: "分割线", icon: "pi pi-minus", keywords: "rule divider hr fengexian" },
  { key: "note", label: "提示框", icon: "pi pi-info-circle", keywords: "admonition note tip warning callout tishi" },
  { key: "collapse", label: "折叠面板", icon: "pi pi-angle-double-down", keywords: "collapse details zhedie" },
  { key: "math", label: "数学公式", icon: "pi pi-percentage", keywords: "math latex katex gongshi" },
  { key: "mermaid", label: "Mermaid 图表", icon: "pi pi-sitemap", keywords: "mermaid diagram chart tubiao" },
  { key: "raw", label: "Markdown 源码", icon: "pi pi-file-edit", keywords: "raw source markdown html yuanma" },
];

export function filterInsertItems(query: string): InsertItem[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return INSERT_ITEMS;
  return INSERT_ITEMS.filter((item) => item.label.toLowerCase().includes(needle) || item.keywords.includes(needle));
}

/** The block an insert item creates, or null for items that need uploads or dialogs. */
export function insertItemBlock(key: string): MarkdownBlock | null {
  if (BLOCK_TYPES.some((type) => type.value === key)) return convertBlock(createBlock("paragraph"), key as BlockType);
  switch (key) {
    case "table":
      return createBlock("table", serializeTable(emptyTable()));
    case "rule":
      return createBlock("thematic-break", "---");
    case "note":
      return createBlock("raw", ":::note\n内容\n:::");
    case "collapse":
      return createBlock("raw", "::: collapse\n- 标题\n\n  内容\n:::");
    case "math":
      return createBlock("raw", "$$\nE = mc^2\n$$");
    case "mermaid":
      return createBlock("code", serializeCode({ fence: "```", language: "mermaid", code: "graph TD\n  A --> B" }));
    default:
      return null;
  }
}

/** Bounded undo/redo history of serialized Markdown snapshots. Typing is coalesced. */
export class EditHistory {
  private past: string[] = [];
  private future: string[] = [];
  private lastRecord = 0;

  constructor(
    private present: string,
    private readonly limit = 200,
    private readonly now: () => number = () => Date.now(),
  ) {}

  get canUndo() {
    return this.past.length > 0;
  }
  get canRedo() {
    return this.future.length > 0;
  }

  record(next: string, coalesce = false) {
    if (next === this.present) return;
    const time = this.now();
    if (!coalesce || !this.past.length || time - this.lastRecord > 1000) {
      this.past.push(this.present);
      if (this.past.length > this.limit) this.past.shift();
    }
    this.lastRecord = coalesce ? time : 0;
    this.present = next;
    this.future = [];
  }

  undo(): string | null {
    const previous = this.past.pop();
    if (previous === undefined) return null;
    this.future.push(this.present);
    this.present = previous;
    this.lastRecord = 0;
    return previous;
  }

  redo(): string | null {
    const next = this.future.pop();
    if (next === undefined) return null;
    this.past.push(this.present);
    this.present = next;
    this.lastRecord = 0;
    return next;
  }

  reset(value: string) {
    this.past = [];
    this.future = [];
    this.present = value;
    this.lastRecord = 0;
  }
}
