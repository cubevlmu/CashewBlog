// Structured views of single Markdown blocks. Each `parse*` returns null when the source
// uses syntax the visual editor cannot represent faithfully, in which case the document
// keeps the block as raw source instead.

import { parseInline, serializeInline } from "./inline-markdown";

const BLOCK_START =
  /^( {0,3})(#{1,6}(?=\s|$)|>|[-+*](?=\s|$)|\d{1,9}[.)](?=\s|$)|={1,}\s*$|-+\s*$|`{3,}|~{3,}|:{2,}|\$\$|\||\[[^\]]*\]:)/;

/** Normalizes inline Markdown and escapes line starts that would turn into other blocks. */
export function textSource(inline: string) {
  return escapeLineStarts(serializeInline(parseInline(inline)));
}

/** Escapes line starts of serialized inline Markdown that would turn into other blocks. */
export function escapeLineStarts(markdown: string) {
  return markdown
    .split("\n")
    .map((line) => {
      const trimmed = line.replace(/^[ \t]+/, "");
      const match = trimmed.match(BLOCK_START);
      if (!match) return trimmed;
      const marker = match[2];
      if (/^\d/.test(marker)) return trimmed.replace(/^(\d+)([.)])/, "$1\\$2");
      return `\\${trimmed}`;
    })
    .join("\n");
}

// Headings ------------------------------------------------------------------------------

export interface HeadingModel {
  level: number;
  text: string;
}

export function parseHeading(source: string): HeadingModel | null {
  const atx = source.match(/^ {0,3}(#{1,6})(?:[ \t]+(.*?))?(?:[ \t]+#+)?[ \t]*$/);
  if (atx && !source.includes("\n")) return { level: atx[1].length, text: atx[2] ?? "" };
  const setext = source.match(/^([\s\S]+?)\n {0,3}(=+|-+)[ \t]*$/);
  if (setext) return { level: setext[2].startsWith("=") ? 1 : 2, text: setext[1].replace(/\s*\n\s*/g, " ").trim() };
  return null;
}

export function serializeHeading(model: HeadingModel) {
  const text = serializeInline(parseInline(model.text.replace(/\n/g, " "))).replace(/(^|\s)(#+)\s*$/, "$1\\$2");
  return `${"#".repeat(model.level)} ${text}`.trimEnd();
}

// Blockquotes -----------------------------------------------------------------------------

/** Paragraphs (inline Markdown) of a simple quote, or null for nested block structures. */
export function parseQuote(source: string): string[] | null {
  const lines = source.split("\n").map((line) => line.replace(/^ {0,3}> ?/, ""));
  if (/^\s*\[!\w+\]/.test(lines[0] ?? "")) return null;
  const paragraphs: string[] = [];
  let current: string[] = [];
  for (const line of lines) {
    if (!line.trim()) {
      if (current.length) paragraphs.push(current.join("\n"));
      current = [];
    } else if (BLOCK_START.test(line)) return null;
    else current.push(line);
  }
  if (current.length) paragraphs.push(current.join("\n"));
  return paragraphs.length ? paragraphs : [""];
}

export function serializeQuote(paragraphs: string[]) {
  const body = paragraphs.map(textSource).filter((paragraph) => paragraph.trim());
  if (!body.length) return ">";
  return body
    .join("\n\n")
    .split("\n")
    .map((line) => (line ? `> ${line}` : ">"))
    .join("\n");
}

// Lists -----------------------------------------------------------------------------------

export interface ListItem {
  text: string;
  checked: boolean | null;
  children: ListModel | null;
}

export interface ListModel {
  ordered: boolean;
  start: number;
  marker: string;
  loose: boolean;
  items: ListItem[];
}

const LIST_ITEM = /^( *)([-+*]|\d{1,9}[.)])(?:( +)(.*))?$/;

function expandTabs(line: string) {
  return line.replace(/^\t+/, (tabs) => "    ".repeat(tabs.length));
}

export function parseList(source: string): ListModel | null {
  const lines = source.split("\n").map(expandTabs);
  interface Level {
    list: ListModel;
    indent: number;
    content: number;
  }
  const first = lines[0]?.match(LIST_ITEM);
  if (!first) return null;
  const root: ListModel = listFor(first[2]);
  const stack: Level[] = [{ list: root, indent: first[1].length, content: 0 }];
  let blank = false;

  for (const line of lines) {
    if (!line.trim()) {
      blank = true;
      continue;
    }
    const match = line.match(LIST_ITEM);
    const indent = line.length - line.trimStart().length;
    if (match) {
      while (stack.length > 1 && indent < stack.at(-1)!.indent) stack.pop();
      let level = stack.at(-1)!;
      const parent = level.list.items.at(-1);
      if (parent && indent >= level.content) {
        parent.children = listFor(match[2]);
        level = { list: parent.children, indent, content: 0 };
        stack.push(level);
      } else if (blank && level.list.items.length) level.list.loose = true;
      const spaces = match[3]?.length ?? 1;
      level.content = indent + match[2].length + (spaces > 4 ? 1 : spaces);
      let text = spaces > 4 ? `${" ".repeat(spaces - 1)}${match[4] ?? ""}` : (match[4] ?? "");
      let checked: boolean | null = null;
      const task = text.match(/^\[([ xX])\](?: +|$)/);
      if (task) {
        checked = task[1] !== " ";
        text = text.slice(task[0].length);
      }
      if (/^ {4}/.test(text) || BLOCK_START.test(text)) return null;
      level.list.items.push({ text, checked, children: null });
    } else {
      // A continuation line joins the last item's paragraph; blank-separated or
      // block-level continuations mean multi-block items, which stay raw.
      const item = stack.at(-1)!.list.items.at(-1);
      const content = line.trimStart();
      if (blank || !item || BLOCK_START.test(content)) return null;
      item.text += `\n${content}`;
    }
    blank = false;
  }
  return root;
}

function listFor(marker: string): ListModel {
  const ordered = /^\d/.test(marker);
  return {
    ordered,
    start: ordered ? Number.parseInt(marker, 10) : 1,
    marker: ordered ? marker.slice(-1) : marker,
    loose: false,
    items: [],
  };
}

export function serializeList(list: ListModel, indent = 0): string {
  const pad = " ".repeat(indent);
  return list.items
    .map((item, index) => {
      const marker = list.ordered ? `${list.start + index}${list.marker}` : list.marker;
      const inner = " ".repeat(marker.length + 1);
      const task = item.checked === null ? "" : `[${item.checked ? "x" : " "}] `;
      const lines = textSource(item.text).split("\n");
      const head = `${pad}${marker} ${task}${lines[0]}`.trimEnd();
      const rest = lines.slice(1).map((line) => `${pad}${inner}${line}`);
      const children = item.children?.items.length ? [serializeList(item.children, indent + marker.length + 1)] : [];
      return [head, ...rest, ...children].join("\n");
    })
    .join(list.loose ? "\n\n" : "\n");
}

export function emptyList(ordered: boolean, task: boolean): ListModel {
  return {
    ordered,
    start: 1,
    marker: ordered ? "." : "-",
    loose: false,
    items: [{ text: "", checked: task ? false : null, children: null }],
  };
}

// Tables ------------------------------------------------------------------------------------

export type Align = "left" | "center" | "right" | null;

export interface TableModel {
  align: Align[];
  header: string[];
  rows: string[][];
}

const DELIMITER_ROW = /^ {0,3}\|?\s*:?-+:?\s*(?:\|\s*:?-+:?\s*)*\|?\s*$/;

function splitRow(line: string): string[] {
  let row = line.trim();
  if (row.startsWith("|")) row = row.slice(1);
  if (row.endsWith("|") && !row.endsWith("\\|")) row = row.slice(0, -1);
  const cells: string[] = [];
  let current = "";
  for (let index = 0; index < row.length; index++) {
    if (row[index] === "\\" && row[index + 1] === "|") {
      current += "|";
      index++;
    } else if (row[index] === "|") {
      cells.push(current.trim());
      current = "";
    } else current += row[index];
  }
  cells.push(current.trim());
  return cells;
}

export function isTableStart(line: string, next: string | undefined) {
  return line.includes("|") && next !== undefined && next.includes("|") && DELIMITER_ROW.test(next);
}

export function parseTable(source: string): TableModel | null {
  const lines = source.split("\n");
  if (lines.length < 2 || !isTableStart(lines[0], lines[1])) return null;
  const header = splitRow(lines[0]);
  const align: Align[] = splitRow(lines[1]).map((cell) =>
    cell.startsWith(":") && cell.endsWith(":") ? "center" : cell.endsWith(":") ? "right" : cell.startsWith(":") ? "left" : null,
  );
  if (align.length !== header.length) return null;
  const rows = lines.slice(2).map((line) => {
    const cells = splitRow(line).slice(0, header.length);
    while (cells.length < header.length) cells.push("");
    return cells;
  });
  return { align, header, rows };
}

function cellSource(cell: string) {
  return serializeInline(parseInline(cell.replace(/\n/g, " "))).replace(/\|/g, "\\|");
}

export function serializeTable(table: TableModel) {
  const row = (cells: string[]) => `| ${cells.map(cellSource).join(" | ")} |`;
  const rule = table.align.map((align) =>
    align === "center" ? ":---:" : align === "right" ? "---:" : align === "left" ? ":---" : "---",
  );
  return [row(table.header), `| ${rule.join(" | ")} |`, ...table.rows.map(row)].join("\n");
}

export function emptyTable(columns = 2, rows = 1): TableModel {
  return {
    align: Array.from({ length: columns }, () => null),
    header: Array.from({ length: columns }, (_, index) => `列 ${index + 1}`),
    rows: Array.from({ length: rows }, () => Array.from({ length: columns }, () => "")),
  };
}

export function insertTableRow(table: TableModel, at: number): TableModel {
  const rows = table.rows.slice();
  rows.splice(Math.max(0, Math.min(at, rows.length)), 0, table.header.map(() => ""));
  return { ...table, rows };
}

export function removeTableRow(table: TableModel, at: number): TableModel {
  return { ...table, rows: table.rows.filter((_, index) => index !== at) };
}

export function insertTableColumn(table: TableModel, at: number): TableModel {
  const index = Math.max(0, Math.min(at, table.header.length));
  const insert = <T,>(cells: T[], value: T) => [...cells.slice(0, index), value, ...cells.slice(index)];
  return {
    align: insert(table.align, null),
    header: insert(table.header, `列 ${table.header.length + 1}`),
    rows: table.rows.map((row) => insert(row, "")),
  };
}

export function removeTableColumn(table: TableModel, at: number): TableModel {
  if (table.header.length <= 1) return table;
  const keep = <T,>(cells: T[]) => cells.filter((_, index) => index !== at);
  return { align: keep(table.align), header: keep(table.header), rows: table.rows.map(keep) };
}

export function alignTableColumn(table: TableModel, at: number, align: Align): TableModel {
  return { ...table, align: table.align.map((value, index) => (index === at ? align : value)) };
}

// Code --------------------------------------------------------------------------------------

export interface CodeModel {
  fence: string;
  language: string;
  code: string;
}

export function parseCode(source: string): CodeModel | null {
  const lines = source.split("\n");
  const open = lines[0].match(/^( {0,3})(`{3,}|~{3,})(.*)$/);
  if (!open || lines.length < 2) return null;
  const fence = open[2];
  if (fence.startsWith("`") && open[3].includes("`")) return null;
  const close = lines.at(-1)!.match(/^ {0,3}(`{3,}|~{3,})\s*$/);
  if (!close || close[1][0] !== fence[0] || close[1].length < fence.length) return null;
  const indent = open[1].length;
  const code = lines
    .slice(1, -1)
    .map((line) => line.replace(new RegExp(`^ {0,${indent}}`), ""))
    .join("\n");
  return { fence, language: open[3].trim(), code };
}

export function serializeCode(model: CodeModel) {
  const char = model.fence[0] === "~" ? "~" : "`";
  const longest = Math.max(0, ...Array.from(model.code.matchAll(char === "`" ? /^ {0,3}(`+)/gm : /^ {0,3}(~+)/gm), (match) => match[1].length));
  const fence = char.repeat(Math.max(3, model.fence.length, longest + 1));
  const language = model.language.trim().replace(/\s+/g, " ");
  return `${fence}${language}\n${model.code}\n${fence}`;
}

// Images ------------------------------------------------------------------------------------

export interface ImageModel {
  alt: string;
  url: string;
  title: string;
}

const IMAGE = /^!\[((?:\\.|[^\]\\])*)\]\((?:<([^>\n]*)>|((?:\\.|[^\s()\\]|\([^\s()]*\))*))(?:\s+"((?:\\.|[^"\\])*)")?\s*\)$/;

export function parseImage(source: string): ImageModel | null {
  const match = source.trim().match(IMAGE);
  if (!match) return null;
  const unescape = (value: string) => value.replace(/\\([!-/:-@[-`{-~])/g, "$1");
  return { alt: unescape(match[1]), url: match[2] ?? unescape(match[3] ?? ""), title: unescape(match[4] ?? "") };
}

export function serializeImage(model: ImageModel) {
  const alt = model.alt.replace(/[\[\]\\]/g, "\\$&");
  const url = /[\s()<>]/.test(model.url) ? `<${model.url.replace(/[<>]/g, encodeURIComponent)}>` : model.url;
  const title = model.title ? ` "${model.title.replace(/["\\]/g, "\\$&")}"` : "";
  return `![${alt}](${url}${title})`;
}
