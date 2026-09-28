// DOM side of the editor: renders block models into contenteditable HTML, reads edited
// DOM back into Markdown and provides caret helpers. Pure Markdown logic lives in the
// sibling modules so it can be unit tested without a browser.

import { inlineHtml, serializeInline, withMark, type InlineRun, type LinkMark, type Mark } from "./inline-markdown";
import { escapeLineStarts, serializeImage, type ListModel } from "./markdown-blocks";

// Reading ------------------------------------------------------------------------------------

function styleMarks(element: HTMLElement, marks: Mark[]) {
  let next = marks;
  const weight = element.style.fontWeight;
  if (weight === "bold" || Number(weight) >= 600) next = withMark(next, "strong");
  if (element.style.fontStyle === "italic") next = withMark(next, "em");
  if (element.style.textDecoration.includes("line-through")) next = withMark(next, "s");
  return next;
}

function collect(node: Node, marks: Mark[], link: LinkMark | null, runs: InlineRun[]) {
  node.childNodes.forEach((child) => {
    if (child.nodeType === Node.TEXT_NODE) {
      const text = (child as Text).data.replace(/ /g, " ").replace(/[​﻿]/g, "");
      if (text) runs.push({ type: "text", text, marks, link });
      return;
    }
    if (!(child instanceof HTMLElement)) return;
    if (child.dataset.md !== undefined) {
      runs.push({ type: "atom", source: child.dataset.md, marks, link });
      return;
    }
    switch (child.tagName) {
      case "BR":
        runs.push({ type: "break", soft: child.hasAttribute("data-md-soft") });
        return;
      case "B":
      case "STRONG":
        return collect(child, withMark(marks, "strong"), link, runs);
      case "I":
      case "EM":
        return collect(child, withMark(marks, "em"), link, runs);
      case "S":
      case "STRIKE":
      case "DEL":
        return collect(child, withMark(marks, "s"), link, runs);
      case "CODE": {
        const text = (child.textContent ?? "").replace(/ /g, " ").replace(/[​﻿]/g, "");
        if (text) runs.push({ type: "text", text, marks: withMark(marks, "code"), link });
        return;
      }
      case "A":
        return collect(child, marks, { href: child.getAttribute("href") ?? "", title: child.getAttribute("title") ?? "" }, runs);
      case "IMG": {
        const image = child as HTMLImageElement;
        runs.push({ type: "atom", source: serializeImage({ alt: image.alt, url: image.getAttribute("src") ?? "", title: "" }), marks, link });
        return;
      }
      case "INPUT":
      case "UL":
      case "OL":
        return;
      case "DIV":
      case "P":
        if (runs.length && runs.at(-1)!.type !== "break") runs.push({ type: "break", soft: true });
        return collect(child, marks, link, runs);
      default:
        return collect(child, styleMarks(child, marks), link, runs);
    }
  });
}

/**
 * Inline Markdown of an element or fragment (nested lists and checkboxes are skipped).
 * `escapeLines` guards line starts that would become other blocks; table cells skip it.
 */
export function readInline(node: Node, escapeLines = true): string {
  const runs: InlineRun[] = [];
  collect(node, [], null, runs);
  while (runs.at(-1)?.type === "break") runs.pop();
  const markdown = serializeInline(runs);
  return escapeLines ? escapeLineStarts(markdown) : markdown;
}

/** List model of a list surface; tolerates DOM the browser rewrote while editing. */
export function readListSurface(element: HTMLElement, fallback: ListModel): ListModel {
  const lists = Array.from(element.children).filter(
    (node): node is HTMLElement => node.tagName === "UL" || node.tagName === "OL",
  );
  if (!lists.length) {
    return { ...fallback, items: [{ text: readInline(element), checked: null, children: null }] };
  }
  const list = readList(lists[0]);
  lists.slice(1).forEach((node) => list.items.push(...readList(node).items));
  return list;
}

export function readQuote(element: HTMLElement): string[] {
  const paragraphs: string[] = [];
  let loose: Node[] = [];
  const flushLoose = () => {
    if (!loose.length) return;
    const fragment = document.createDocumentFragment();
    loose.forEach((node) => fragment.appendChild(node.cloneNode(true)));
    paragraphs.push(readInline(fragment));
    loose = [];
  };
  element.childNodes.forEach((child) => {
    if (child instanceof HTMLElement && (child.tagName === "P" || child.tagName === "DIV")) {
      flushLoose();
      paragraphs.push(readInline(child));
    } else loose.push(child);
  });
  flushLoose();
  return paragraphs;
}

export function readList(element: HTMLElement): ListModel {
  const ordered = element.tagName === "OL";
  const list: ListModel = {
    ordered,
    start: ordered ? (element as HTMLOListElement).start || 1 : 1,
    marker: element.dataset.mdMarker ?? (ordered ? "." : "-"),
    loose: element.dataset.mdLoose === "true",
    items: [],
  };
  element.childNodes.forEach((child) => {
    if (child instanceof HTMLElement && (child.tagName === "UL" || child.tagName === "OL")) {
      const last = list.items.at(-1);
      const nested = readList(child);
      if (!last) list.items.push(...nested.items);
      else if (last.children) last.children.items.push(...nested.items);
      else last.children = nested;
      return;
    }
    if (!(child instanceof HTMLElement) || child.tagName !== "LI") {
      const text = child.textContent?.trim();
      if (text) list.items.push({ text: readInline(wrap(child)), checked: null, children: null });
      return;
    }
    const checkbox = child.querySelector<HTMLInputElement>(":scope > input[type=checkbox]");
    const nested = Array.from(child.children).filter(
      (node): node is HTMLElement => node.tagName === "UL" || node.tagName === "OL",
    );
    let children: ListModel | null = null;
    for (const node of nested) {
      const model = readList(node);
      if (children) children.items.push(...model.items);
      else children = model;
    }
    list.items.push({ text: readInline(child), checked: checkbox ? checkbox.checked : null, children });
  });
  return list;
}

function wrap(node: Node) {
  const fragment = document.createDocumentFragment();
  fragment.appendChild(node.cloneNode(true));
  return fragment;
}

// Rendering ----------------------------------------------------------------------------------

export function quoteHtml(paragraphs: string[]) {
  return paragraphs.map((paragraph) => `<p>${inlineHtml(paragraph) || "<br>"}</p>`).join("");
}

export function checkboxHtml(checked: boolean) {
  return `<input type="checkbox" contenteditable="false" tabindex="-1" aria-label="完成"${checked ? " checked" : ""}>`;
}

export function listItemsHtml(list: ListModel): string {
  return list.items
    .map((item) => {
      const task = item.checked === null ? "" : checkboxHtml(item.checked);
      const text = inlineHtml(item.text) || "<br>";
      const children = item.children?.items.length ? listHtml(item.children) : "";
      return `<li${item.checked === null ? "" : ' class="md-task"'}>${task}${text}${children}</li>`;
    })
    .join("");
}

export function listHtml(list: ListModel): string {
  const tag = list.ordered ? "ol" : "ul";
  const start = list.ordered && list.start !== 1 ? ` start="${list.start}"` : "";
  const loose = list.loose ? ' data-md-loose="true"' : "";
  return `<${tag}${start} data-md-marker="${list.marker}"${loose}>${listItemsHtml(list)}</${tag}>`;
}

// Selection ----------------------------------------------------------------------------------

export function selectionRange(within: Node): Range | null {
  const selection = window.getSelection();
  if (!selection?.rangeCount) return null;
  const range = selection.getRangeAt(0);
  return within.contains(range.startContainer) && within.contains(range.endContainer) ? range : null;
}

export function placeRange(range: Range) {
  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
}

function hasContent(fragment: DocumentFragment) {
  return !!fragment.textContent?.replace(/[​﻿]/g, "") || !!fragment.querySelector?.("[data-md], img");
}

/** Range from the start of `element` to `end` (defaults to the element end). */
function spanRange(element: Node, from: "start" | Range, to: "end" | Range, boundary?: Node | null) {
  const range = document.createRange();
  range.selectNodeContents(element);
  if (from !== "start") range.setStart(from.endContainer, from.endOffset);
  if (to !== "end") range.setEnd(to.startContainer, to.startOffset);
  else if (boundary) range.setEndBefore(boundary);
  return range;
}

export function caretAtStart(element: Node) {
  const range = selectionRange(element);
  return !!range && range.collapsed && !hasContent(spanRange(element, "start", range).cloneContents());
}

export function caretAtEnd(element: Node, boundary?: Node | null) {
  const range = selectionRange(element);
  return !!range && range.collapsed && !hasContent(spanRange(element, range, "end", boundary).cloneContents());
}

/** Splits the element's inline content at the caret; the selection is deleted first. */
export function splitAtCaret(element: Node, boundary?: Node | null): { before: string; after: string } | null {
  const range = selectionRange(element);
  if (!range) return null;
  if (!range.collapsed) range.deleteContents();
  const before = spanRange(element, "start", range).cloneContents();
  const after = spanRange(element, range, "end", boundary).cloneContents();
  return { before: readInline(before), after: readInline(after) };
}

/** Moves the part after the caret out of the element and returns it as a fragment. */
export function extractAfterCaret(element: Node, boundary?: Node | null): DocumentFragment | null {
  const range = selectionRange(element);
  if (!range) return null;
  if (!range.collapsed) range.deleteContents();
  return spanRange(element, range, "end", boundary).extractContents();
}

function nodeLength(node: Node): number {
  if (node.nodeType === Node.TEXT_NODE) return (node as Text).data.length;
  if (!(node instanceof HTMLElement)) return 0;
  if (node.dataset.md !== undefined || node.tagName === "BR" || node.tagName === "IMG") return 1;
  if (node.tagName === "INPUT") return 0;
  let length = 0;
  node.childNodes.forEach((child) => (length += nodeLength(child)));
  return length;
}

/** Caret position as a text offset inside `element`, or -1 without a selection there. */
export function caretOffset(element: Node): number {
  const range = selectionRange(element);
  if (!range) return -1;
  return textLength(spanRange(element, "start", range).cloneContents());
}

export function textLength(element: Node) {
  let length = 0;
  element.childNodes.forEach((child) => (length += nodeLength(child)));
  return length;
}

/** Places the caret at a text offset (or the end) of `element`. */
export function setCaret(element: HTMLElement, offset: number | "end" = "end") {
  const range = document.createRange();
  let remaining = offset === "end" ? Number.POSITIVE_INFINITY : offset;
  const walk = (node: Node): boolean => {
    for (const child of Array.from(node.childNodes)) {
      if (child.nodeType === Node.TEXT_NODE) {
        const length = (child as Text).data.length;
        if (remaining <= length) {
          range.setStart(child, remaining);
          return true;
        }
        remaining -= length;
      } else if (child instanceof HTMLElement) {
        if (child.tagName === "UL" || child.tagName === "OL" || child.tagName === "INPUT") continue;
        if (child.dataset.md !== undefined || child.tagName === "BR" || child.tagName === "IMG") {
          if (remaining === 0) {
            range.setStartBefore(child);
            return true;
          }
          remaining -= 1;
          if (remaining === 0 && child.tagName !== "BR") {
            range.setStartAfter(child);
            return true;
          }
        } else if (walk(child)) return true;
      }
    }
    return false;
  };
  if (!walk(element)) {
    const boundary = Array.from(element.childNodes).find(
      (child) => child instanceof HTMLElement && (child.tagName === "UL" || child.tagName === "OL"),
    );
    range.selectNodeContents(element);
    if (boundary) range.setEndBefore(boundary);
    range.collapse(false);
    // Keep the caret before a trailing placeholder <br>.
    const last = boundary ? boundary.previousSibling : element.lastChild;
    if (last instanceof HTMLElement && last.tagName === "BR") range.setStartBefore(last), range.collapse(true);
  }
  range.collapse(true);
  (element.closest<HTMLElement>('[contenteditable="true"]') ?? element).focus({ preventScroll: true });
  placeRange(range);
}

/** Inserts HTML at the caret and places the caret after it. */
export function insertHtmlAtCaret(element: HTMLElement, html: string) {
  const range = selectionRange(element);
  if (!range) return false;
  range.deleteContents();
  const fragment = range.createContextualFragment(html);
  const last = fragment.lastChild;
  range.insertNode(fragment);
  if (last) {
    range.setStartAfter(last);
    range.collapse(true);
    placeRange(range);
  }
  return true;
}

/** Whether the caret sits on the first/last visual line of `element`. */
export function caretOnEdgeLine(element: HTMLElement, edge: "first" | "last") {
  const range = selectionRange(element);
  if (!range) return false;
  const caret = range.getClientRects()[0] ?? range.getBoundingClientRect();
  const box = element.getBoundingClientRect();
  if (!caret || (caret.top === 0 && caret.bottom === 0)) return edge === "first" ? caretAtStart(element) : caretAtEnd(element);
  const line = Number.parseFloat(getComputedStyle(element).lineHeight) || 24;
  return edge === "first" ? caret.top - box.top < line : box.bottom - caret.bottom < line;
}

// Inline shortcuts ----------------------------------------------------------------------------

const INLINE_RULES: { pattern: RegExp; tag: string; delimiter: number }[] = [
  { pattern: /(?:^|[^*\\])\*\*([^*\s](?:[^*]*[^*\s])?)\*\*$/, tag: "strong", delimiter: 2 },
  { pattern: /(?:^|[^*\\])\*([^*\s](?:[^*]*[^*\s])?)\*$/, tag: "em", delimiter: 1 },
  { pattern: /(?:^|[^~\\])~~([^~\s](?:[^~]*[^~\s])?)~~$/, tag: "s", delimiter: 2 },
  { pattern: /(?:^|[^`\\])`([^`]+)`$/, tag: "code", delimiter: 1 },
];

/** Turns `**text**`, `*text*`, `~~text~~` and `` `code` `` just typed before the caret into marks. */
export function applyInlineShortcut(element: HTMLElement): boolean {
  const range = selectionRange(element);
  if (!range?.collapsed || range.startContainer.nodeType !== Node.TEXT_NODE) return false;
  const node = range.startContainer as Text;
  if (node.parentElement?.closest("code")) return false;
  const before = node.data.slice(0, range.startOffset);
  for (const rule of INLINE_RULES) {
    const match = before.match(rule.pattern);
    if (!match) continue;
    const inner = match[1];
    const start = range.startOffset - inner.length - rule.delimiter * 2;
    const target = document.createRange();
    target.setStart(node, start);
    target.setEnd(node, range.startOffset);
    target.deleteContents();
    const mark = document.createElement(rule.tag);
    mark.textContent = inner;
    target.insertNode(mark);
    // A zero-width space lets typing continue outside the new mark; readInline drops it.
    const tail = document.createTextNode("​");
    mark.after(tail);
    const caret = document.createRange();
    caret.setStart(tail, 1);
    caret.collapse(true);
    placeRange(caret);
    return true;
  }
  return false;
}

/** The closest `tag` element around the selection inside `root`. */
export function closestInSelection(root: HTMLElement, selector: string): HTMLElement | null {
  const range = selectionRange(root);
  if (!range) return null;
  const node = range.commonAncestorContainer;
  const element = node instanceof HTMLElement ? node : node.parentElement;
  const match = element?.closest<HTMLElement>(selector);
  return match && root.contains(match) ? match : null;
}

/** Wraps the selection in inline code, or unwraps the code element it sits in. */
export function toggleInlineCode(root: HTMLElement) {
  const existing = closestInSelection(root, "code");
  if (existing) {
    existing.replaceWith(document.createTextNode(existing.textContent ?? ""));
    return;
  }
  const range = selectionRange(root);
  if (!range || range.collapsed) return;
  const code = document.createElement("code");
  code.textContent = range.toString();
  range.deleteContents();
  range.insertNode(code);
  range.selectNodeContents(code);
  placeRange(range);
}
