// Inline Markdown <-> "runs" (flat text segments carrying their marks).
// The editor renders runs to HTML for contenteditable and reads the DOM back into runs,
// so every inline round trip goes through this one canonical serializer. Syntax the
// editor does not edit itself (images, math, directives, HTML, footnotes, reference
// links, entities, autolinks) becomes an "atom" whose source is kept byte for byte.

export type Mark = "strong" | "em" | "s" | "code";

export interface LinkMark {
  href: string;
  title: string;
}

export type InlineRun =
  | { type: "text"; text: string; marks: Mark[]; link: LinkMark | null }
  | { type: "atom"; source: string; marks: Mark[]; link: LinkMark | null }
  | { type: "break"; soft: boolean };

const MARK_ORDER: Mark[] = ["strong", "em", "s", "code"];
const DELIMITER: Record<Exclude<Mark, "code">, string> = { strong: "**", em: "*", s: "~~" };
const PUNCTUATION = /[!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~]/;

const ATOM_PATTERNS = [
  /^!\[(?:\\.|[^\]\\])*\]\((?:<[^>\n]*>|(?:\\.|[^\s()\\]|\([^\s()]*\))*)(?:\s+(?:"[^"]*"|'[^']*'|\([^)]*\)))?\s*\)(?:\{[^}\n]*\})?/, // image
  /^\[\^[^\]\s]+\]/, // footnote reference
  /^<[a-zA-Z][a-zA-Z0-9+.-]{1,31}:[^\s<>]*>/, // URI autolink
  /^<[^\s<>@]+@[^\s<>]+\.[^\s<>]+>/, // email autolink
  /^<!--[\s\S]*?-->/, // HTML comment
  /^<\/?[a-zA-Z][\w-]*(?:\s+[^<>]*)?\/?>/, // inline HTML tag
  /^\$\$[^$]+?\$\$/, // inline display math
  /^\$(?![\s$])[^$\n]*?[^\s\\$]\$|^\$[^\s$]\$/, // inline math
  /^&(?:#\d{1,7}|#[xX][0-9a-fA-F]{1,6}|[a-zA-Z][a-zA-Z0-9]{1,31});/, // entity
];
const TEXT_DIRECTIVE = /^:[a-zA-Z][\w-]*(?:\[[^\]\n]*\](?:\{[^}\n]*\})?|\{[^}\n]*\})/;

// ---------------------------------------------------------------------------------------
// Parsing

function sameMarks(a: Mark[], b: Mark[]) {
  return a.length === b.length && a.every((mark, index) => mark === b[index]);
}
function sameLink(a: LinkMark | null, b: LinkMark | null) {
  return a === b || (!!a && !!b && a.href === b.href && a.title === b.title);
}
export function withMark(marks: Mark[], mark: Mark) {
  return MARK_ORDER.filter((item) => item === mark || marks.includes(item));
}

function pushText(runs: InlineRun[], text: string, marks: Mark[], link: LinkMark | null) {
  if (!text) return;
  const last = runs.at(-1);
  if (last?.type === "text" && sameMarks(last.marks, marks) && sameLink(last.link, link)) last.text += text;
  else runs.push({ type: "text", text, marks, link });
}

function backtickRun(source: string, index: number) {
  let end = index;
  while (source[end] === "`") end++;
  return end - index;
}

/** Index of the code span closing a backtick run of `length` starting at `from`, or -1. */
function codeClose(source: string, from: number, length: number) {
  let index = from;
  while (index < source.length) {
    const next = source.indexOf("`", index);
    if (next < 0) return -1;
    const run = backtickRun(source, next);
    if (run === length) return next;
    index = next + run;
  }
  return -1;
}

/** Index after the `]` that balances the `[` at `open`, skipping escapes and code spans. */
function bracketClose(source: string, open: number) {
  let depth = 0;
  for (let index = open; index < source.length; index++) {
    const char = source[index];
    if (char === "\\") index++;
    else if (char === "`") {
      const run = backtickRun(source, index);
      const close = codeClose(source, index + run, run);
      index = close < 0 ? index + run - 1 : close + run - 1;
    } else if (char === "[") depth++;
    else if (char === "]" && --depth === 0) return index;
  }
  return -1;
}

/** Parses `(destination "title")` at `open`; returns the link and the index after `)`. */
function linkTail(source: string, open: number): { link: LinkMark; end: number } | null {
  if (source[open] !== "(") return null;
  let index = open + 1;
  while (source[index] === " ") index++;
  let href = "";
  if (source[index] === "<") {
    const close = source.indexOf(">", index);
    if (close < 0 || source.slice(index, close).includes("\n")) return null;
    href = source.slice(index + 1, close);
    index = close + 1;
  } else {
    let depth = 0;
    const start = index;
    while (index < source.length) {
      const char = source[index];
      if (/\s/.test(char) || (char === ")" && depth === 0)) break;
      if (char === "(") depth++;
      if (char === ")") depth--;
      index += char === "\\" ? 2 : 1;
    }
    href = source.slice(start, index).replace(/\\([()\\])/g, "$1");
  }
  let title = "";
  const titleMatch = source.slice(index).match(/^\s+("((?:\\.|[^"\\])*)"|'((?:\\.|[^'\\])*)'|\(((?:\\.|[^)\\])*)\))/);
  if (titleMatch) {
    title = (titleMatch[2] ?? titleMatch[3] ?? titleMatch[4] ?? "").replace(/\\(.)/g, "$1");
    index += titleMatch[0].length;
  }
  while (source[index] === " ") index++;
  if (source[index] !== ")") return null;
  return { link: { href, title }, end: index + 1 };
}

function isWhitespace(char: string | undefined) {
  return char === undefined || /\s/.test(char);
}
function isAlphanumeric(char: string | undefined) {
  return char !== undefined && /[\p{L}\p{N}]/u.test(char);
}

/** Start index of the `length` closing delimiters of `char` after `from`, or -1. */
function delimiterClose(source: string, from: number, char: string, length: number) {
  for (let index = from; index < source.length; index++) {
    const current = source[index];
    if (current === "\\") {
      index++;
      continue;
    }
    if (current === "`") {
      const run = backtickRun(source, index);
      const close = codeClose(source, index + run, run);
      if (close >= 0) index = close + run - 1;
      else index += run - 1;
      continue;
    }
    if (current === "[" ) {
      const close = bracketClose(source, index);
      const tail = close >= 0 ? linkTail(source, close + 1) : null;
      if (tail) {
        index = tail.end - 1;
        continue;
      }
    }
    if (current !== char) continue;
    let end = index;
    while (source[end] === char) end++;
    const run = end - index;
    const rightFlanking = !isWhitespace(source[index - 1]) && (char !== "_" || !isAlphanumeric(source[end]));
    if (rightFlanking && run >= length && index > from) return end - length;
    index = end - 1;
  }
  return -1;
}

/** Parses inline Markdown into runs. */
export function parseInline(source: string, marks: Mark[] = [], link: LinkMark | null = null): InlineRun[] {
  const runs: InlineRun[] = [];
  let index = 0;
  const atom = (value: string) => {
    runs.push({ type: "atom", source: value, marks, link });
    index += value.length;
  };
  while (index < source.length) {
    const char = source[index];
    const rest = source.slice(index);

    if (char === "\\") {
      const next = source[index + 1];
      if (next === "\n") {
        runs.push({ type: "break", soft: false });
        index += 2;
      } else if (next !== undefined && PUNCTUATION.test(next)) {
        pushText(runs, next, marks, link);
        index += 2;
      } else {
        pushText(runs, char, marks, link);
        index++;
      }
      continue;
    }

    if (char === "\n") {
      const last = runs.at(-1);
      let hard = false;
      if (last?.type === "text" && / {2,}$/.test(last.text)) hard = true;
      if (last?.type === "text") last.text = last.text.replace(/ +$/, "");
      if (last?.type === "text" && !last.text) runs.pop();
      runs.push({ type: "break", soft: !hard });
      index++;
      while (source[index] === " ") index++;
      continue;
    }

    if (char === "`") {
      const run = backtickRun(source, index);
      const close = codeClose(source, index + run, run);
      if (close < 0) {
        pushText(runs, "`".repeat(run), marks, link);
        index += run;
        continue;
      }
      let code = source.slice(index + run, close).replace(/\n/g, " ");
      if (code.length > 1 && code.startsWith(" ") && code.endsWith(" ") && code.trim()) code = code.slice(1, -1);
      runs.push({ type: "text", text: code, marks: withMark(marks, "code"), link });
      index = close + run;
      continue;
    }

    if (char === "!" || char === "<" || char === "$" || char === "&" || (char === "[" && source[index + 1] === "^")) {
      const match = ATOM_PATTERNS.map((pattern) => rest.match(pattern)).find(Boolean);
      if (match) {
        atom(match[0]);
        continue;
      }
    }

    if (char === ":" && source[index - 1] !== ":") {
      const match = rest.match(TEXT_DIRECTIVE);
      if (match) {
        atom(match[0]);
        continue;
      }
    }

    if (char === "[") {
      const close = bracketClose(source, index);
      if (close > index) {
        const tail = linkTail(source, close + 1);
        if (tail) {
          runs.push(...parseInline(source.slice(index + 1, close), marks, tail.link));
          index = tail.end;
          continue;
        }
        const reference = source.slice(close + 1).match(/^\[[^\]\n]*\]/);
        if (reference) {
          atom(source.slice(index, close + 1 + reference[0].length));
          continue;
        }
      }
    }

    if (char === "*" || char === "_" || char === "~") {
      let end = index;
      while (source[end] === char) end++;
      const run = end - index;
      const leftFlanking = !isWhitespace(source[end]) && (char !== "_" || !isAlphanumeric(source[index - 1]));
      const length = char === "~" ? (run === 2 ? 2 : 0) : Math.min(run, 2);
      if (leftFlanking && length) {
        // The outer delimiters open the span; any extra ones start its content (`***a***`).
        const start = index + length;
        const close = delimiterClose(source, start, char, length);
        if (close > start) {
          const mark: Mark = char === "~" ? "s" : length === 2 ? "strong" : "em";
          runs.push(...parseInline(source.slice(start, close), withMark(marks, mark), link));
          index = close + length;
          continue;
        }
      }
      pushText(runs, char, marks, link);
      index++;
      continue;
    }

    pushText(runs, char, marks, link);
    index++;
  }
  return mergeRuns(runs);
}

function mergeRuns(runs: InlineRun[]): InlineRun[] {
  const merged: InlineRun[] = [];
  for (const run of runs) {
    const last = merged.at(-1);
    if (run.type === "text" && last?.type === "text" && sameMarks(last.marks, run.marks) && sameLink(last.link, run.link)) {
      last.text += run.text;
    } else if (run.type !== "text" || run.text) merged.push(run.type === "text" ? { ...run } : run);
  }
  return merged;
}

// ---------------------------------------------------------------------------------------
// Serialization

export function escapeText(text: string, inLink = false) {
  let out = "";
  for (let index = 0; index < text.length; index++) {
    const char = text[index];
    const previous = text[index - 1];
    const next = text[index + 1];
    if (char === "\\" || char === "*" || char === "`" || char === "$") out += `\\${char}`;
    else if (char === "_" && (!isAlphanumeric(previous) || !isAlphanumeric(next))) out += "\\_";
    else if (char === "~" && (next === "~" || previous === "~")) out += "\\~";
    else if (char === "<" && next !== undefined && /[a-zA-Z/!?]/.test(next)) out += "\\<";
    else if (char === "&" && /^&(?:#\d+|#[xX][0-9a-fA-F]+|[a-zA-Z][a-zA-Z0-9]*);/.test(text.slice(index))) out += "\\&";
    else if (char === "[" && (next === "^" || /^\[[^\]]*\][([]/.test(text.slice(index)))) out += "\\[";
    else if (char === "]" && inLink) out += "\\]";
    else if (char === "!" && next === "[") out += "\\!";
    else if (char === ":" && previous !== ":" && TEXT_DIRECTIVE.test(text.slice(index))) out += "\\:";
    else out += char;
  }
  return out;
}

function codeSpan(code: string) {
  const longest = Math.max(0, ...Array.from(code.matchAll(/`+/g), (match) => match[0].length));
  const fence = "`".repeat(longest + 1);
  const pad = code.startsWith("`") || code.endsWith("`") || (code.startsWith(" ") && code.endsWith(" ") && code.trim()) ? " " : "";
  return `${fence}${pad}${code}${pad}${fence}`;
}

function linkDestination(href: string) {
  if (!href || /[\s<>]/.test(href) || /[()]/.test(href.replace(/\([^()\s]*\)/g, ""))) return `<${href.replace(/[<>]/g, encodeURIComponent)}>`;
  return href;
}

function linkClose(link: LinkMark) {
  const title = link.title ? ` "${link.title.replace(/["\\]/g, "\\$&")}"` : "";
  return `](${linkDestination(link.href)}${title})`;
}

type Segment = { kind: "content"; value: string; marks: Mark[]; link: LinkMark | null } | { kind: "break"; soft: boolean };

/** Moves whitespace at the edges of an emphasis span outside of its delimiters. */
function segments(runs: InlineRun[]): Segment[] {
  const list: Segment[] = [];
  runs.forEach((run) => {
    if (run.type === "break") list.push({ kind: "break", soft: run.soft });
    else if (run.type === "atom") list.push({ kind: "content", value: run.source, marks: run.marks, link: run.link });
    else if (run.marks.includes("code")) list.push({ kind: "content", value: `\u0000${run.text}`, marks: run.marks, link: run.link });
    else {
      const match = run.text.match(/^(\s*)([\s\S]*?)(\s*)$/)!;
      const escape = (text: string) => escapeText(text, !!run.link);
      if (match[1]) list.push({ kind: "content", value: match[1], marks: [], link: run.link });
      if (match[2]) list.push({ kind: "content", value: escape(match[2]), marks: run.marks, link: run.link });
      if (match[3]) list.push({ kind: "content", value: match[3], marks: [], link: run.link });
    }
  });
  // Whitespace-only pieces keep the marks shared by both neighbours so spans stay joined.
  list.forEach((segment, index) => {
    if (segment.kind !== "content" || segment.value.trim() || segment.marks.length) return;
    const before = list[index - 1];
    const after = list[index + 1];
    if (before?.kind === "content" && after?.kind === "content") {
      segment.marks = before.marks.filter((mark) => mark !== "code" && after.marks.includes(mark));
    }
  });
  return list;
}

/** Serializes runs back to inline Markdown. */
export function serializeInline(runs: InlineRun[]): string {
  let out = "";
  let open: Mark[] = [];
  let openLink: LinkMark | null = null;
  let code: string | null = null;
  const flushCode = () => {
    if (code !== null) out += codeSpan(code);
    code = null;
  };
  const closeTo = (keep: Mark[]) => {
    while (open.length > keep.length || open.some((mark, index) => keep[index] !== mark)) {
      const mark = open.pop()!;
      if (mark === "code") flushCode();
      else out += DELIMITER[mark];
    }
  };
  for (const segment of segments(runs)) {
    if (segment.kind === "break") {
      closeTo([]);
      if (openLink) out += linkClose(openLink), (openLink = null);
      out += segment.soft ? "\n" : "\\\n";
      continue;
    }
    if (!sameLink(openLink, segment.link)) {
      closeTo([]);
      if (openLink) out += linkClose(openLink);
      openLink = segment.link;
      if (openLink) out += "[";
    }
    const marks = segment.marks;
    let shared = 0;
    while (shared < open.length && shared < marks.length && open[shared] === marks[shared]) shared++;
    closeTo(open.slice(0, shared));
    for (const mark of marks.slice(shared)) {
      open.push(mark);
      if (mark === "code") code = "";
      else out += DELIMITER[mark];
    }
    if (segment.value.startsWith("\u0000")) code = (code ?? "") + segment.value.slice(1);
    else out += segment.value;
  }
  closeTo([]);
  if (openLink) out += linkClose(openLink);
  return out;
}

/** Plain text of inline Markdown (atoms keep their source). */
export function inlineText(source: string) {
  return parseInline(source)
    .map((run) => (run.type === "break" ? "\n" : run.type === "atom" ? run.source : run.text))
    .join("");
}

// ---------------------------------------------------------------------------------------
// HTML rendering for the contenteditable surface

export function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);
}

const TAG: Record<Mark, string> = { strong: "strong", em: "em", s: "s", code: "code" };

function atomHtml(source: string) {
  const image = source.match(/^!\[((?:\\.|[^\]\\])*)\]\(<?([^\s)>]*)/);
  const body = image
    ? `<img src="${escapeHtml(image[2])}" alt="${escapeHtml(image[1])}" class="md-inline-image">`
    : escapeHtml(source);
  return `<span class="md-atom" contenteditable="false" data-md="${escapeHtml(source)}">${body}</span>`;
}

/** Renders runs as editable HTML. A trailing break gets a placeholder `<br>` so the empty last line shows. */
export function inlineHtml(source: string): string {
  const runs = parseInline(source);
  let out = "";
  let open: Mark[] = [];
  let openLink: LinkMark | null = null;
  const closeAll = () => {
    while (open.length) out += `</${TAG[open.pop()!]}>`;
    if (openLink) out += "</a>", (openLink = null);
  };
  for (const run of runs) {
    if (run.type === "break") {
      closeAll();
      out += run.soft ? '<br data-md-soft="">' : "<br>";
      continue;
    }
    if (!sameLink(openLink, run.link)) {
      closeAll();
      openLink = run.link;
      if (openLink) {
        const title = openLink.title ? ` title="${escapeHtml(openLink.title)}"` : "";
        out += `<a href="${escapeHtml(openLink.href)}"${title}>`;
      }
    }
    let shared = 0;
    while (shared < open.length && open[shared] === run.marks[shared]) shared++;
    while (open.length > shared) out += `</${TAG[open.pop()!]}>`;
    for (const mark of run.marks.slice(shared)) open.push(mark), (out += `<${TAG[mark]}>`);
    out += run.type === "atom" ? atomHtml(run.source) : escapeHtml(run.text);
  }
  closeAll();
  if (runs.at(-1)?.type === "break") out += "<br>";
  return out;
}
