<script setup lang="ts">
// Block-based WYSIWYG Markdown editor assembled from PrimeVue controls. Markdown stays the
// canonical value: each block keeps its source, edited blocks are re-serialized from the
// DOM, and syntax the editor cannot represent is kept as raw source blocks.
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from "vue";
import Button from "primevue/button";
import ContextMenu from "primevue/contextmenu";
import Dialog from "primevue/dialog";
import Drawer from "primevue/drawer";
import Message from "primevue/message";
import Popover from "primevue/popover";
import Textarea from "primevue/textarea";
import type { MenuItem } from "primevue/menuitem";
import BlockInspector from "./BlockInspector.vue";
import EditableSurface from "./EditableSurface.vue";
import EditorCodeBlock from "./EditorCodeBlock.vue";
import EditorLinkDialog from "./EditorLinkDialog.vue";
import EditorTable from "./EditorTable.vue";
import EditorToolbar from "./EditorToolbar.vue";
import SlashMenu from "./SlashMenu.vue";
import "./editor.css";
import {
  BLOCK_TYPES,
  EditHistory,
  INSERT_ITEMS,
  blockType,
  convertBlock,
  enterRule,
  filterInsertItems,
  insertItemBlock,
  shortcutRule,
  type BlockType,
  type LinkValue,
  type MarkCommand,
} from "../editor/editor-commands";
import {
  applyInlineShortcut,
  caretAtEnd,
  caretAtStart,
  caretOffset,
  caretOnEdgeLine,
  checkboxHtml,
  closestInSelection,
  extractAfterCaret,
  insertHtmlAtCaret,
  listHtml,
  placeRange,
  quoteHtml,
  readInline,
  readList,
  readListSurface,
  readQuote,
  selectionRange,
  setCaret,
  splitAtCaret,
  textLength,
  toggleInlineCode,
} from "../editor/dom";
import { escapeText, inlineHtml, serializeInline } from "../editor/inline-markdown";
import {
  emptyList,
  parseHeading,
  parseImage,
  parseList,
  parseQuote,
  serializeHeading,
  serializeImage,
  serializeList,
  serializeQuote,
  type ImageModel,
} from "../editor/markdown-blocks";
import { createBlock, parseMarkdown, rawLabel, serializeMarkdown, type MarkdownBlock } from "../editor/markdown-document";
import { errorMessage, upload } from "../state";

const props = defineProps<{ modelValue: string }>();
const emit = defineEmits<{
  "update:modelValue": [value: string];
  error: [message: string];
}>();

type Surface = InstanceType<typeof EditableSurface>;
type Focusable = { focus: (position?: "start" | "end") => void };

const root = ref<HTMLElement>();
const fileInput = ref<HTMLInputElement>();
const blocks = ref<MarkdownBlock[]>([]);
const activeId = ref<string | null>(null);
const canUndo = ref(false);
const canRedo = ref(false);
const uploading = ref(0);
const failedUploads = ref<File[]>([]);
const dragging = ref(false);
const compact = ref(false);
const refs = new Map<string, Surface | Focusable | HTMLElement>();
const history = new EditHistory(props.modelValue);
let lastEmitted = props.modelValue;
let composing = false;
let remembered: { id: string; range: Range | null } | null = null;

const activeIndex = computed(() => blocks.value.findIndex((block) => block.id === activeId.value));
const activeBlock = computed(() => blocks.value[activeIndex.value]);

// Document state -------------------------------------------------------------------------------

/** Keeps a trailing paragraph so there is always somewhere to type after tables and images. */
function withTrailingParagraph(list: MarkdownBlock[]) {
  if (list.at(-1)?.kind !== "paragraph") list.push(createBlock("paragraph"));
  return list;
}
function load(markdown: string) {
  const parsed = parseMarkdown(markdown);
  blocks.value = withTrailingParagraph(parsed.document.blocks);
  if (parsed.failed) emit("error", "正文 Markdown 无法完整解析，已按原文保留。");
}
load(props.modelValue);

function emitChange(coalesce = false) {
  const value = serializeMarkdown({ blocks: blocks.value });
  if (value === lastEmitted) return;
  lastEmitted = value;
  history.record(value, coalesce);
  canUndo.value = history.canUndo;
  canRedo.value = history.canRedo;
  emit("update:modelValue", value);
}
function indexOf(id: string | null | undefined) {
  return blocks.value.findIndex((block) => block.id === id);
}
function splice(index: number, remove: number, ...insert: MarkdownBlock[]) {
  blocks.value.splice(index, remove, ...insert);
  withTrailingParagraph(blocks.value);
  emitChange();
}
function setSource(block: MarkdownBlock, source: string) {
  block.source = source;
  emitChange(true);
}
function applyHistory(value: string | null) {
  if (value === null) return;
  const index = Math.max(0, activeIndex.value);
  lastEmitted = value;
  load(value);
  canUndo.value = history.canUndo;
  canRedo.value = history.canRedo;
  emit("update:modelValue", value);
  const block = blocks.value[Math.min(index, blocks.value.length - 1)];
  if (block) void focusBlock(block.id);
}

watch(
  () => props.modelValue,
  (value) => {
    // Autosave round trips and other outside writes never replace text mid-composition.
    if (value === lastEmitted || composing) return;
    lastEmitted = value;
    history.record(value);
    canUndo.value = history.canUndo;
    canRedo.value = history.canRedo;
    load(value);
  },
);

// Block refs and focus ------------------------------------------------------------------------

function setRef(id: string, value: unknown) {
  if (value) refs.set(id, value as Surface | Focusable | HTMLElement);
  else refs.delete(id);
}
function surfaceOf(id: string): Surface | null {
  const target = refs.get(id);
  return target && !(target instanceof HTMLElement) && "sync" in target ? target : null;
}
function elementOf(id: string): HTMLElement | null {
  const target = refs.get(id);
  if (target instanceof HTMLElement) return target;
  return surfaceOf(id)?.element ?? null;
}
async function focusBlock(id: string, position: "start" | "end" | number = "end") {
  await nextTick();
  activeId.value = id;
  const target = refs.get(id);
  if (!target) return;
  if (target instanceof HTMLElement) target.focus();
  else if ("sync" in target) {
    const host = target.element;
    if (!host) return;
    // List surfaces take the caret in their first or last (deepest) item.
    const items = host.querySelectorAll<HTMLElement>("li");
    const element = items.length ? items[position === "start" ? 0 : items.length - 1] : host;
    setCaret(element, position === "start" ? 0 : position);
  } else target.focus(position === "start" ? "start" : "end");
}
function moveFocus(id: string, direction: -1 | 1) {
  const block = blocks.value[indexOf(id) + direction];
  if (!block) return false;
  void focusBlock(block.id, direction < 0 ? "end" : "start");
  return true;
}
function onFocusIn(event: FocusEvent) {
  const host = (event.target as HTMLElement).closest<HTMLElement>("[data-block-id]");
  if (host?.dataset.blockId) activeId.value = host.dataset.blockId;
}
/** The contenteditable surface holding the selection (paragraphs, list, cells, ...). */
function currentSurface(): HTMLElement | null {
  const selection = window.getSelection();
  const node = selection?.rangeCount ? selection.getRangeAt(0).startContainer : null;
  const element = node instanceof HTMLElement ? node : node?.parentElement;
  const surface = element?.closest<HTMLElement>(".md-surface");
  return surface && root.value?.contains(surface) ? surface : null;
}
function notifyInput(element: HTMLElement) {
  element.dispatchEvent(new Event("input", { bubbles: true }));
}
function contentLength(element: HTMLElement) {
  return textLength(element) - (element.lastChild instanceof HTMLBRElement ? 1 : 0);
}

// Renderers and readers per block kind ---------------------------------------------------------

const renderQuote = (source: string) => quoteHtml(parseQuote(source) ?? [""]);
const readQuoteSurface = (element: HTMLElement) => serializeQuote(readQuote(element));
const renderList = (source: string) => listHtml(parseList(source) ?? emptyList(false, false));
function headingLevel(block: MarkdownBlock) {
  return parseHeading(block.source)?.level ?? 1;
}
function renderHeading(source: string) {
  return inlineHtml(parseHeading(source)?.text ?? "");
}
function headingReader(block: MarkdownBlock) {
  return (element: HTMLElement) => serializeHeading({ level: headingLevel(block), text: readInline(element, false) });
}
function listReader(block: MarkdownBlock) {
  return (element: HTMLElement) =>
    serializeList(readListSurface(element, parseList(block.source) ?? emptyList(false, false)));
}
function imageOf(block: MarkdownBlock): ImageModel {
  return parseImage(block.source) ?? { alt: "", url: "", title: "" };
}
function rawPreview(source: string) {
  const lines = source.split("\n");
  return lines.length > 8 ? `${lines.slice(0, 8).join("\n")}\n…` : source;
}

// Typing: shortcuts and slash menu --------------------------------------------------------------

function plainText(element: HTMLElement) {
  return (element.textContent ?? "").replace(/ /g, " ").replace(/[​﻿]/g, "");
}
/** Removes the first `length` characters of text, e.g. a typed `## ` shortcut. */
function stripLeadingText(element: HTMLElement, length: number) {
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  let remaining = length;
  while (remaining > 0 && walker.nextNode()) {
    const node = walker.currentNode as Text;
    const take = Math.min(remaining, node.data.length);
    node.data = node.data.slice(take);
    remaining -= take;
  }
}
function onSurfaceChange(block: MarkdownBlock, source: string) {
  setSource(block, source);
  const element = elementOf(block.id);
  if (!element) return;
  if (block.kind === "paragraph") {
    const text = plainText(element);
    if (/^\/\S{0,24}$/.test(text) && caretAtEnd(element)) openSlash(block, text.slice(1));
    else if (slash.open) closeSlash();
    const rule = shortcutRule(text);
    if (rule && caretOffset(element) === rule.length) {
      stripLeadingText(element, rule.length);
      let next = convertBlock(createBlock("paragraph", readInline(element)), rule.type);
      const list = rule.start && rule.start !== 1 ? parseList(next.source) : null;
      if (list) next = createBlock("list", serializeList({ ...list, start: rule.start! }));
      splice(indexOf(block.id), 1, next);
      void focusBlock(next.id, "start");
      return;
    }
  }
  if (applyInlineShortcut(element)) notifyInput(element);
}

const slash = reactive({ open: false, blockId: "", query: "", highlighted: 0, top: 0, left: 0 });
const slashItems = computed(() => filterInsertItems(slash.query));
function openSlash(block: MarkdownBlock, query: string) {
  const element = elementOf(block.id);
  if (!element || !root.value) return;
  const box = root.value.getBoundingClientRect();
  const rect = element.getBoundingClientRect();
  if (compact.value) {
    insertMenu.targetId = block.id;
    insertMenu.drawer = true;
    return;
  }
  if (slash.blockId !== block.id || slash.query !== query) slash.highlighted = 0;
  Object.assign(slash, { open: true, blockId: block.id, query, top: rect.bottom - box.top + 4, left: rect.left - box.left });
}
function closeSlash() {
  slash.open = false;
}
function onSlashKey(event: KeyboardEvent) {
  const count = slashItems.value.length;
  if (event.key === "ArrowDown" || event.key === "ArrowUp") {
    event.preventDefault();
    if (count) slash.highlighted = (slash.highlighted + (event.key === "ArrowDown" ? 1 : count - 1)) % count;
    return true;
  }
  if (event.key === "Enter" || event.key === "Tab") {
    const item = slashItems.value[slash.highlighted];
    if (!item) return false;
    event.preventDefault();
    chooseInsert(item.key);
    return true;
  }
  if (event.key === "Escape") {
    event.preventDefault();
    closeSlash();
    return true;
  }
  return false;
}

// Keyboard ---------------------------------------------------------------------------------------

const isMod = (event: KeyboardEvent) => event.ctrlKey || event.metaKey;

function onRootKeydown(event: KeyboardEvent) {
  if (!isMod(event) || event.altKey) return;
  const key = event.key.toLowerCase();
  if (key === "z" || key === "y") {
    event.preventDefault();
    applyHistory(key === "y" || event.shiftKey ? history.redo() : history.undo());
  }
}
function onBeforeInput(event: Event) {
  const type = (event as InputEvent).inputType;
  if (type === "historyUndo" || type === "historyRedo") {
    event.preventDefault();
    applyHistory(type === "historyUndo" ? history.undo() : history.redo());
  }
}
function onComposition(active: boolean) {
  composing = active;
}
function onFormatShortcut(event: KeyboardEvent) {
  if (!isMod(event) || event.altKey) return false;
  const key = event.key.toLowerCase();
  if (key === "b") toggleMark("bold");
  else if (key === "i") toggleMark("italic");
  else if (key === "e") toggleMark("code");
  else if (key === "x" && event.shiftKey) toggleMark("strike");
  else if (key === "k") openLink();
  else return false;
  event.preventDefault();
  return true;
}
function navigate(event: KeyboardEvent, block: MarkdownBlock, element: HTMLElement) {
  if (event.shiftKey || isMod(event) || event.altKey) return;
  const back =
    (event.key === "ArrowUp" && caretOnEdgeLine(element, "first")) || (event.key === "ArrowLeft" && caretAtStart(element));
  const forward =
    (event.key === "ArrowDown" && caretOnEdgeLine(element, "last")) || (event.key === "ArrowRight" && caretAtEnd(element));
  if ((back && moveFocus(block.id, -1)) || (forward && moveFocus(block.id, 1))) event.preventDefault();
}

function onTextKeydown(event: KeyboardEvent, block: MarkdownBlock) {
  if (event.isComposing || event.keyCode === 229) return;
  const element = event.currentTarget as HTMLElement;
  if (slash.open && slash.blockId === block.id && onSlashKey(event)) return;
  if (onFormatShortcut(event)) return;
  const index = indexOf(block.id);

  if (event.key === "Enter" && !event.shiftKey && !isMod(event)) {
    if (block.kind === "blockquote") return quoteEnter(event, block, element);
    event.preventDefault();
    const rule = block.kind === "paragraph" ? enterRule(plainText(element).trim()) : null;
    if (rule) {
      const trailing = rule.kind === "thematic-break" ? [createBlock("paragraph")] : [];
      splice(index, 1, rule, ...trailing);
      if (rule.kind === "raw") openRaw(rule.id);
      else void focusBlock((trailing[0] ?? rule).id, "start");
      return;
    }
    if (block.kind === "heading" && caretAtStart(element) && plainText(element)) {
      splice(index, 0, createBlock("paragraph"));
      return;
    }
    const halves = splitAtCaret(element);
    if (!halves) return;
    block.source = block.kind === "heading" ? serializeHeading({ level: headingLevel(block), text: halves.before }) : halves.before;
    const next = createBlock("paragraph", halves.after);
    splice(index + 1, 0, next);
    void focusBlock(next.id, "start");
    return;
  }
  if (event.key === "Enter" && block.kind === "heading") {
    event.preventDefault();
    return;
  }
  if (event.key === "Backspace" && !isMod(event) && caretAtStart(element)) {
    if (block.kind === "heading" || block.kind === "blockquote") {
      event.preventDefault();
      const next = convertBlock(block, "paragraph");
      splice(index, 1, next);
      void focusBlock(next.id, "start");
      return;
    }
    const previous = blocks.value[index - 1];
    if (!previous) return;
    event.preventDefault();
    const previousElement = elementOf(previous.id);
    if ((previous.kind === "paragraph" || previous.kind === "heading") && previousElement) {
      const offset = contentLength(previousElement);
      previous.source =
        previous.kind === "heading"
          ? serializeHeading({ level: headingLevel(previous), text: (parseHeading(previous.source)?.text ?? "") + block.source })
          : previous.source + block.source;
      splice(index, 1);
      void focusBlock(previous.id, offset);
    } else if (!block.source.trim()) {
      splice(index, 1);
      void focusBlock(previous.id);
    } else void focusBlock(previous.id);
    return;
  }
  if (event.key === "Delete" && block.kind === "paragraph" && caretAtEnd(element)) {
    const next = blocks.value[index + 1];
    if (next?.kind !== "paragraph") return;
    event.preventDefault();
    const offset = contentLength(element);
    block.source += next.source;
    splice(index + 1, 1);
    void focusBlock(block.id, offset);
    return;
  }
  navigate(event, block, element);
}

/** Enter on an empty last quote paragraph leaves the quote. */
function quoteEnter(event: KeyboardEvent, block: MarkdownBlock, element: HTMLElement) {
  const paragraph = closestInSelection(element, "p, div");
  if (!paragraph || paragraph === element || paragraph !== element.lastElementChild || plainText(paragraph).trim()) return;
  event.preventDefault();
  paragraph.remove();
  const index = indexOf(block.id);
  const next = createBlock("paragraph");
  if (!plainText(element).trim()) splice(index, 1, next);
  else {
    block.source = serializeQuote(readQuote(element));
    splice(index + 1, 0, next);
  }
  void focusBlock(next.id, "start");
}

// Lists ------------------------------------------------------------------------------------------

function nestedList(item: HTMLElement) {
  return item.querySelector<HTMLElement>(":scope > ul, :scope > ol");
}
function childList(parent: HTMLElement, like: HTMLElement) {
  let list = nestedList(parent);
  if (!list) {
    list = document.createElement(like.tagName.toLowerCase());
    list.dataset.mdMarker = like.dataset.mdMarker ?? (like.tagName === "OL" ? "." : "-");
    parent.appendChild(list);
  }
  return list;
}
function indentItem(item: HTMLElement) {
  const previous = item.previousElementSibling;
  if (!(previous instanceof HTMLElement) || previous.tagName !== "LI") return false;
  childList(previous, item.parentElement!).appendChild(item);
  return true;
}
function outdentItem(item: HTMLElement) {
  const list = item.parentElement!;
  const parentItem = list.parentElement;
  if (!parentItem || parentItem.tagName !== "LI") return false;
  // Following siblings become children of the outdented item.
  const following: Element[] = [];
  for (let sibling = item.nextElementSibling; sibling; sibling = sibling.nextElementSibling) following.push(sibling);
  if (following.length) {
    const target = childList(item, list);
    following.forEach((node) => target.appendChild(node));
  }
  parentItem.after(item);
  if (!list.children.length) list.remove();
  return true;
}
function listFallback(block: MarkdownBlock) {
  return parseList(block.source) ?? emptyList(false, false);
}
/** Enter on an empty top-level item: split the list around a new paragraph. */
function exitList(block: MarkdownBlock, element: HTMLElement, item: HTMLElement) {
  const list = item.parentElement!;
  const position = Array.from(list.children).indexOf(item);
  const rest = document.createElement(list.tagName.toLowerCase());
  rest.dataset.mdMarker = list.dataset.mdMarker ?? "";
  if (list instanceof HTMLOListElement) (rest as HTMLOListElement).start = (list.start || 1) + position;
  while (item.nextElementSibling) rest.appendChild(item.nextElementSibling);
  item.remove();
  const index = indexOf(block.id);
  const paragraph = createBlock("paragraph");
  const after = rest.children.length ? [createBlock("list", serializeList(readList(rest)))] : [];
  if (!list.children.length) splice(index, 1, paragraph, ...after);
  else {
    block.source = serializeList(readListSurface(element, listFallback(block)));
    splice(index + 1, 0, paragraph, ...after);
  }
  void focusBlock(paragraph.id, "start");
}
/** Backspace at the start of the first item turns it into a paragraph above the list. */
function liftFirstItem(block: MarkdownBlock, element: HTMLElement, item: HTMLElement) {
  const paragraph = createBlock("paragraph", readInline(item));
  item.remove();
  const index = indexOf(block.id);
  if (!element.querySelector("li")) splice(index, 1, paragraph);
  else {
    block.source = serializeList(readListSurface(element, listFallback(block)));
    splice(index, 0, paragraph);
  }
  void focusBlock(paragraph.id, "start");
}
function onListKeydown(event: KeyboardEvent, block: MarkdownBlock) {
  if (event.isComposing || event.keyCode === 229) return;
  if (onFormatShortcut(event)) return;
  const element = event.currentTarget as HTMLElement;
  const item = closestInSelection(element, "li");
  if (!item) return navigate(event, block, element);
  const topList = element.querySelector(":scope > ul, :scope > ol");
  const nested = nestedList(item);

  if (event.key === "Tab") {
    event.preventDefault();
    const offset = caretOffset(item);
    if (event.shiftKey ? outdentItem(item) : indentItem(item)) {
      setCaret(item, Math.max(0, offset));
      notifyInput(element);
    }
    return;
  }
  if (event.key === "Enter" && !event.shiftKey && !isMod(event)) {
    event.preventDefault();
    if (!nested && !readInline(item).trim()) {
      if (item.parentElement !== topList) {
        outdentItem(item);
        setCaret(item, 0);
        notifyInput(element);
      } else exitList(block, element, item);
      return;
    }
    const tail = extractAfterCaret(item, nested);
    const next = document.createElement("li");
    if (item.classList.contains("md-task")) {
      next.className = "md-task";
      next.innerHTML = checkboxHtml(false);
    }
    if (tail) next.appendChild(tail);
    if (!plainText(next).trim() && !next.querySelector("[data-md], img")) next.appendChild(document.createElement("br"));
    if (nested) next.appendChild(nested);
    if (!plainText(item).trim() && !item.querySelector("[data-md], img")) item.appendChild(document.createElement("br"));
    item.after(next);
    setCaret(next, 0);
    notifyInput(element);
    return;
  }
  if (event.key === "Backspace" && !isMod(event) && caretAtStart(item)) {
    const checkbox = item.querySelector(":scope > input[type=checkbox]");
    if (checkbox) {
      event.preventDefault();
      checkbox.remove();
      item.classList.remove("md-task");
      notifyInput(element);
    } else if (item.parentElement !== topList) {
      event.preventDefault();
      outdentItem(item);
      setCaret(item, 0);
      notifyInput(element);
    } else if (!item.previousElementSibling && !nested) {
      event.preventDefault();
      liftFirstItem(block, element, item);
    }
    return;
  }
  navigate(event, block, element);
}

// Non-text blocks (image, rule, raw) --------------------------------------------------------------

function onObjectKeydown(event: KeyboardEvent, block: MarkdownBlock) {
  if (event.target !== event.currentTarget) return;
  const index = indexOf(block.id);
  if (event.key === "Enter") {
    event.preventDefault();
    if (block.kind === "raw") return openRaw(block.id);
    const next = createBlock("paragraph");
    splice(index + 1, 0, next);
    void focusBlock(next.id, "start");
  } else if (event.key === "Backspace" || event.key === "Delete") {
    event.preventDefault();
    removeBlock(block.id);
  } else if (event.key === "ArrowUp" || event.key === "ArrowLeft") {
    if (moveFocus(block.id, -1)) event.preventDefault();
  } else if (event.key === "ArrowDown" || event.key === "ArrowRight") {
    if (moveFocus(block.id, 1)) event.preventDefault();
  }
}
function exitBlock(block: MarkdownBlock) {
  const index = indexOf(block.id);
  const after = blocks.value[index + 1];
  if (after?.kind === "paragraph" && !after.source.trim()) return void focusBlock(after.id, "start");
  const next = createBlock("paragraph");
  splice(index + 1, 0, next);
  void focusBlock(next.id, "start");
}

// Block commands -----------------------------------------------------------------------------------

function convertActive(type: BlockType) {
  const block = activeBlock.value;
  if (!block || blockType(block) === type) return;
  const next = convertBlock(block, type);
  splice(activeIndex.value, 1, next);
  void focusBlock(next.id);
}
function removeBlock(id: string) {
  const index = indexOf(id);
  if (index < 0) return;
  splice(index, 1);
  const neighbour = blocks.value[Math.max(0, index - 1)];
  if (neighbour) void focusBlock(neighbour.id);
}
function moveBlock(id: string, delta: -1 | 1) {
  const index = indexOf(id);
  const target = index + delta;
  if (index < 0 || target < 0 || target >= blocks.value.length) return;
  const [block] = blocks.value.splice(index, 1);
  splice(target, 0, block);
}
function duplicateBlock(id: string) {
  const index = indexOf(id);
  const block = blocks.value[index];
  if (!block) return;
  const copy = createBlock(block.kind, block.source);
  splice(index + 1, 0, copy);
  void focusBlock(copy.id);
}
function toggleMark(command: MarkCommand) {
  const element = currentSurface();
  if (!element) return;
  if (command === "code") {
    toggleInlineCode(element);
    notifyInput(element);
  } else document.execCommand(command === "bold" ? "bold" : command === "italic" ? "italic" : "strikeThrough");
}

// Insert menu ---------------------------------------------------------------------------------------

const insertMenu = reactive({ targetId: "" as string, drawer: false });
const insertPopover = ref<InstanceType<typeof Popover>>();
function openInsertMenu(event?: Event, targetId = activeId.value ?? blocks.value.at(-1)?.id ?? "") {
  closeSlash();
  insertMenu.targetId = targetId;
  if (compact.value || !event) insertMenu.drawer = true;
  else insertPopover.value?.toggle(event);
}
function chooseInsert(key: string) {
  const fromSlash = slash.open;
  const targetId = fromSlash ? slash.blockId : insertMenu.targetId || activeId.value;
  closeSlash();
  insertPopover.value?.hide();
  insertMenu.drawer = false;
  let index = indexOf(targetId);
  if (index < 0) index = blocks.value.length - 1;
  const target = blocks.value[index];
  // An empty paragraph (or the paragraph holding the `/query`) is replaced in place.
  const replace = target.kind === "paragraph" && (!plainText(elementOf(target.id) ?? document.createElement("p")).trim() || fromSlash);
  if (replace) target.source = "";
  if (key === "image" || key === "file") {
    activeId.value = target.id;
    remembered = { id: target.id, range: null };
    pickFiles(key);
    return;
  }
  if (key === "raw") {
    const block = createBlock("raw");
    splice(replace ? index : index + 1, replace ? 1 : 0, block);
    openRaw(block.id);
    return;
  }
  const block = insertItemBlock(key);
  if (!block) return;
  splice(replace ? index : index + 1, replace ? 1 : 0, block);
  if (block.kind === "raw") openRaw(block.id);
  else void focusBlock(block.id);
}

// Block actions ---------------------------------------------------------------------------------------

const actions = reactive({ id: "", drawer: false });
const actionsPopover = ref<InstanceType<typeof Popover>>();
const actionsBlock = computed(() => blocks.value.find((block) => block.id === actions.id));
function openActions(id: string | null | undefined, event?: Event, anchor?: HTMLElement) {
  if (!id) return;
  actions.id = id;
  activeId.value = id;
  if (compact.value || (!event && !anchor)) actions.drawer = true;
  else actionsPopover.value?.show(event ?? new MouseEvent("click"), anchor);
}
function closeActions() {
  actions.drawer = false;
  actionsPopover.value?.hide();
}
function onAction(run: () => void) {
  closeActions();
  run();
}
function applyImage(model: ImageModel) {
  const block = actionsBlock.value;
  if (!block) return;
  closeActions();
  block.source = serializeImage(model);
  emitChange();
}

// Context menu: right click on large screens, long press / right click on touch and narrow ones -------------

const contextMenu = ref<InstanceType<typeof ContextMenu>>();
const context = reactive({ id: "", text: false, hasSelection: false });
let contextSelection: { element: HTMLElement; range: Range } | null = null;
let lastContextOpen = 0;
let press: { timer: number; x: number; y: number } | null = null;

function openContext(id: string, event?: MouseEvent) {
  // Android fires both a long-press timer and a contextmenu event; open once.
  const now = Date.now();
  if (now - lastContextOpen < 800) return;
  lastContextOpen = now;
  const element = currentSurface();
  const range = element ? selectionRange(element) : null;
  contextSelection = element && range ? { element, range: range.cloneRange() } : null;
  Object.assign(context, { id, text: !!element, hasSelection: !!range && !range.collapsed });
  activeId.value = id;
  closeSlash();
  if (compact.value || !event) openActions(id);
  else contextMenu.value?.show(event);
}
function onContextMenu(event: MouseEvent) {
  if (event.shiftKey) return; // Shift + right click keeps the browser's own menu.
  const host = (event.target as HTMLElement).closest<HTMLElement>("[data-block-id]");
  if (!host?.dataset.blockId || !root.value?.contains(host)) return;
  event.preventDefault();
  cancelPress();
  openContext(host.dataset.blockId, event);
}
function cancelPress() {
  if (press) window.clearTimeout(press.timer);
  press = null;
}
function onTouchStart(event: TouchEvent) {
  cancelPress();
  const touch = event.touches[0];
  const id = (event.target as HTMLElement).closest<HTMLElement>("[data-block-id]")?.dataset.blockId;
  if (event.touches.length !== 1 || !touch || !id) return;
  const timer = window.setTimeout(() => {
    press = null;
    openContext(id);
  }, 550);
  press = { timer, x: touch.clientX, y: touch.clientY };
}
function onTouchMove(event: TouchEvent) {
  const touch = event.touches[0];
  if (press && touch && Math.hypot(touch.clientX - press.x, touch.clientY - press.y) > 10) cancelPress();
}
/** Runs a command against the selection saved when the menu opened (the menu took focus). */
function withContextSelection(run: () => void) {
  const saved = contextSelection;
  if (!saved?.element.isConnected) return;
  saved.element.focus({ preventScroll: true });
  placeRange(saved.range);
  run();
}
async function pasteFromClipboard() {
  const saved = contextSelection;
  try {
    const text = await navigator.clipboard.readText();
    if (!saved?.element.isConnected) return;
    saved.element.focus({ preventScroll: true });
    placeRange(saved.range);
    pasteText(saved.element, text);
  } catch {
    emit("error", "浏览器未允许读取剪贴板，请使用 Ctrl+V 粘贴。");
  }
}
const contextItems = computed<MenuItem[]>(() => {
  const index = indexOf(context.id);
  const block = blocks.value[index];
  if (!block) return [];
  const type = blockType(block);
  const mark = (label: string, command: MarkCommand): MenuItem => ({
    label,
    disabled: !context.hasSelection,
    command: () => withContextSelection(() => toggleMark(command)),
  });
  return [
    ...(context.text
      ? [
          { label: "剪切", icon: "pi pi-file-export", disabled: !context.hasSelection, command: () => withContextSelection(() => document.execCommand("cut")) },
          { label: "复制", icon: "pi pi-copy", disabled: !context.hasSelection, command: () => withContextSelection(() => document.execCommand("copy")) },
          { label: "粘贴", icon: "pi pi-clipboard", command: () => void pasteFromClipboard() },
          { separator: true },
          {
            label: "格式",
            icon: "pi pi-pen-to-square",
            items: [
              mark("加粗", "bold"),
              mark("斜体", "italic"),
              mark("删除线", "strike"),
              mark("行内代码", "code"),
              { label: "链接…", icon: "pi pi-link", command: () => withContextSelection(openLink) },
            ],
          },
        ]
      : []),
    ...(type
      ? [
          {
            label: "转换为",
            icon: "pi pi-arrow-right-arrow-left",
            items: BLOCK_TYPES.map((item) => ({
              label: item.label,
              icon: item.icon,
              disabled: item.value === type,
              command: () => convertActive(item.value),
            })),
          },
        ]
      : []),
    {
      label: "在下方插入",
      icon: "pi pi-plus-circle",
      items: INSERT_ITEMS.map((item) => ({
        label: item.label,
        icon: item.icon,
        command: () => {
          insertMenu.targetId = block.id;
          chooseInsert(item.key);
        },
      })),
    },
    { separator: true },
    ...(block.kind === "raw" ? [{ label: "编辑源码…", icon: "pi pi-file-edit", command: () => openRaw(block.id) }] : []),
    ...(block.kind === "image"
      ? [{ label: "图片属性…", icon: "pi pi-image", command: () => openActions(block.id, undefined, elementOf(block.id) ?? undefined) }]
      : []),
    { label: "上移", icon: "pi pi-arrow-up", disabled: index === 0, command: () => moveBlock(block.id, -1) },
    { label: "下移", icon: "pi pi-arrow-down", disabled: index >= blocks.value.length - 1, command: () => moveBlock(block.id, 1) },
    { label: "复制此块", icon: "pi pi-clone", command: () => duplicateBlock(block.id) },
    { label: "删除此块", icon: "pi pi-trash", command: () => removeBlock(block.id) },
  ];
});

// Raw source dialog --------------------------------------------------------------------------------------

const raw = reactive({ visible: false, id: "", value: "" });
function openRaw(id: string) {
  const block = blocks.value.find((item) => item.id === id);
  if (!block) return;
  Object.assign(raw, { id, value: block.source, visible: true });
}
/** Replaces only the edited block; its new source may parse into several blocks. */
function saveRaw() {
  const index = indexOf(raw.id);
  raw.visible = false;
  if (index < 0) return;
  const parsed = parseMarkdown(raw.value).document.blocks;
  splice(index, 1, ...parsed);
  const last = parsed.at(-1) ?? blocks.value[Math.min(index, blocks.value.length - 1)];
  if (last) void focusBlock(last.id);
}
function onRawHide() {
  const index = indexOf(raw.id);
  if (index >= 0 && blocks.value[index].kind === "raw" && !blocks.value[index].source.trim()) splice(index, 1);
}

// Links ---------------------------------------------------------------------------------------------------

const link = reactive({ visible: false, editing: false, value: { text: "", href: "", title: "" } as LinkValue });
let linkContext: { element: HTMLElement; range: Range | null; anchor: HTMLAnchorElement | null } | null = null;
function openLink() {
  const element = currentSurface();
  const range = element ? (selectionRange(element)?.cloneRange() ?? null) : null;
  const anchor = element ? (closestInSelection(element, "a") as HTMLAnchorElement | null) : null;
  linkContext = element ? { element, range, anchor } : null;
  link.editing = !!anchor;
  link.value = {
    text: anchor?.textContent ?? range?.toString() ?? "",
    href: anchor?.getAttribute("href") ?? "",
    title: anchor?.getAttribute("title") ?? "",
  };
  link.visible = true;
}
function applyLink(value: LinkValue) {
  const context = linkContext;
  const text = value.text || value.href;
  if (!context) {
    insert(serializeInline([{ type: "text", text, marks: [], link: { href: value.href, title: value.title } }]));
    return;
  }
  const { element, anchor } = context;
  if (anchor) {
    anchor.setAttribute("href", value.href);
    if (value.title) anchor.setAttribute("title", value.title);
    else anchor.removeAttribute("title");
    if (anchor.textContent !== text) anchor.textContent = text;
    notifyInput(element);
    return;
  }
  element.focus({ preventScroll: true });
  if (context.range) placeRange(context.range);
  else setCaret(element);
  const range = selectionRange(element);
  if (!range) return;
  const created = document.createElement("a");
  created.setAttribute("href", value.href);
  if (value.title) created.setAttribute("title", value.title);
  if (!range.collapsed && (!value.text || value.text === range.toString())) created.appendChild(range.extractContents());
  else {
    range.deleteContents();
    created.textContent = text;
  }
  range.insertNode(created);
  range.setStartAfter(created);
  range.collapse(true);
  placeRange(range);
  notifyInput(element);
}
function removeLink() {
  const anchor = linkContext?.anchor;
  if (!anchor || !linkContext) return;
  anchor.replaceWith(...Array.from(anchor.childNodes));
  notifyInput(linkContext.element);
}
function onLinkClose() {
  linkContext?.element.focus({ preventScroll: true });
}

// Selection bubble -------------------------------------------------------------------------------------------

const bubble = reactive({ visible: false, top: 0, left: 0 });
let hoverCapable = false;
function onSelectionChange() {
  const selection = window.getSelection();
  const surface = currentSurface();
  if (!hoverCapable || compact.value || !surface || !selection || selection.isCollapsed || !root.value) {
    bubble.visible = false;
    return;
  }
  const rect = selection.getRangeAt(0).getBoundingClientRect();
  const box = root.value.getBoundingClientRect();
  bubble.top = rect.top - box.top - 48;
  bubble.left = Math.max(8, Math.min(rect.left - box.left + rect.width / 2 - 110, box.width - 228));
  bubble.visible = true;
}

// Media: uploads, paste and drop --------------------------------------------------------------------------------

const pickKind = ref<"image" | "file" | "replace">("image");
function pickFiles(kind: "image" | "file" | "replace") {
  if (kind !== "replace" && !remembered) rememberSelection();
  pickKind.value = kind;
  if (!fileInput.value) return;
  fileInput.value.value = "";
  fileInput.value.accept = kind === "file" ? "" : "image/*";
  fileInput.value.multiple = kind !== "replace";
  fileInput.value.click();
}
function onFilesPicked() {
  const files = Array.from(fileInput.value?.files ?? []);
  if (pickKind.value === "replace") void addFiles(files.slice(0, 1), actions.id);
  else void addFiles(files);
}
async function addFiles(files: File[], replaceId?: string) {
  if (!files.length) return;
  if (uploading.value) {
    emit("error", "已有文件正在上传，请稍候。");
    return;
  }
  if (!replaceId && !remembered) rememberSelection();
  uploading.value = files.length;
  for (const file of files) {
    try {
      const asset = await upload(file);
      const name = (asset.altText ?? asset.originalFileName).replace(/[\[\]\\]/g, "");
      const target = replaceId ? blocks.value.find((block) => block.id === replaceId) : undefined;
      if (target) {
        const model = parseImage(target.source);
        target.source = serializeImage({ alt: model?.alt || name, url: asset.url, title: model?.title ?? "" });
        emitChange();
      } else {
        insert(asset.kind === "image" ? `![${name}](${asset.url})` : `[${name}](${asset.url})`);
        rememberSelection();
      }
    } catch (error) {
      failedUploads.value.push(file);
      emit("error", errorMessage(error));
    } finally {
      uploading.value--;
    }
  }
  remembered = null;
}
function retryUploads() {
  const files = failedUploads.value;
  failedUploads.value = [];
  void addFiles(files);
}
function onPaste(event: ClipboardEvent) {
  const files = Array.from(event.clipboardData?.files ?? []);
  if (files.length) {
    event.preventDefault();
    rememberSelection();
    void addFiles(files);
    return;
  }
  const element = currentSurface();
  if (!element) return;
  // Only plain text is taken from the clipboard and read as Markdown, so pasted pages
  // cannot inject markup; links and images written in Markdown survive.
  event.preventDefault();
  pasteText(element, event.clipboardData?.getData("text/plain") ?? "");
}
function pasteText(element: HTMLElement, raw: string) {
  const text = raw.replace(/\r\n?/g, "\n");
  if (!text) return;
  const host = element.closest<HTMLElement>("[data-block-id]");
  const block = blocks.value.find((item) => item.id === host?.dataset.blockId);
  if (block?.kind === "paragraph" && element === elementOf(block.id)) {
    rememberSelection();
    insert(text);
    return;
  }
  const parsed = parseMarkdown(text).document.blocks;
  const inline =
    parsed.length === 1 && parsed[0].kind === "paragraph"
      ? parsed[0].source
      : text.split(/\n+/).map((line) => escapeText(line.trim())).join(" ");
  insertHtmlAtCaret(element, inlineHtml(inline));
  notifyInput(element);
}
function caretRangeAt(x: number, y: number): Range | null {
  const doc = document as Document & {
    caretRangeFromPoint?: (x: number, y: number) => Range | null;
    caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null;
  };
  if (doc.caretRangeFromPoint) return doc.caretRangeFromPoint(x, y);
  const position = doc.caretPositionFromPoint?.(x, y);
  if (!position) return null;
  const range = document.createRange();
  range.setStart(position.offsetNode, position.offset);
  return range;
}
function onDragOver(event: DragEvent) {
  if (!event.dataTransfer?.types.includes("Files")) return;
  event.preventDefault();
  dragging.value = true;
}
function onDrop(event: DragEvent) {
  dragging.value = false;
  const files = Array.from(event.dataTransfer?.files ?? []);
  if (!files.length) return;
  event.preventDefault();
  const range = caretRangeAt(event.clientX, event.clientY);
  const node = range?.startContainer;
  const host = (node instanceof HTMLElement ? node : node?.parentElement)?.closest<HTMLElement>("[data-block-id]");
  if (range && host?.dataset.blockId && root.value?.contains(host)) {
    activeId.value = host.dataset.blockId;
    placeRange(range);
  }
  rememberSelection();
  void addFiles(files);
}

// Public API (used by PostEditorView's media library) ---------------------------------------------------------

function rememberSelection() {
  const id = activeId.value ?? blocks.value.at(-1)?.id;
  if (!id) return;
  const element = elementOf(id);
  const range = element ? selectionRange(element) : null;
  remembered = { id, range: range?.cloneRange() ?? null };
}
/** Inserts Markdown at the remembered (or current) selection. */
function insert(markdown: string) {
  const target = remembered ?? { id: activeId.value ?? blocks.value.at(-1)!.id, range: null };
  remembered = null;
  const parsed = parseMarkdown(markdown).document.blocks;
  if (!parsed.length) return;
  let index = indexOf(target.id);
  if (index < 0) index = blocks.value.length - 1;
  const block = blocks.value[index];
  const surface = surfaceOf(block.id);
  const element = surface?.element;
  const restore = () => {
    if (!element) return;
    element.focus({ preventScroll: true });
    if (target.range && element.contains(target.range.startContainer)) placeRange(target.range);
    else setCaret(element);
  };
  if (element && parsed.length === 1 && parsed[0].kind === "paragraph") {
    restore();
    insertHtmlAtCaret(element, inlineHtml(parsed[0].source));
    notifyInput(element);
    activeId.value = block.id;
    return;
  }
  // Block content splits a paragraph at the caret, otherwise it goes after the block.
  if (block.kind === "paragraph" && element) {
    restore();
    const halves = splitAtCaret(element) ?? { before: block.source, after: "" };
    splice(
      index,
      1,
      ...(halves.before.trim() ? [createBlock("paragraph", halves.before)] : []),
      ...parsed,
      ...(halves.after.trim() ? [createBlock("paragraph", halves.after)] : []),
    );
  } else splice(index + 1, 0, ...parsed);
  void focusBlock(parsed.at(-1)!.id);
}
defineExpose({ rememberSelection, insert });

// Lifecycle ------------------------------------------------------------------------------------------------------

let media: MediaQueryList | null = null;
function onMedia() {
  compact.value = !!media?.matches;
}
onMounted(() => {
  media = window.matchMedia("(max-width: 639px)");
  media.addEventListener("change", onMedia);
  onMedia();
  hoverCapable = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  document.addEventListener("selectionchange", onSelectionChange);
});
onBeforeUnmount(() => {
  media?.removeEventListener("change", onMedia);
  document.removeEventListener("selectionchange", onSelectionChange);
  refs.clear();
});
</script>

<template>
  <section
    ref="root"
    class="md-editor relative flex min-w-0 flex-col"
    :class="{ 'is-dragging': dragging }"
    @focusin="onFocusIn"
    @keydown="onRootKeydown"
    @beforeinput="onBeforeInput"
    @compositionstart="onComposition(true)"
    @compositionend="onComposition(false)"
    @paste="onPaste"
    @dragover="onDragOver"
    @dragleave="dragging = false"
    @drop="onDrop"
  >
    <EditorToolbar
      :type="blockType(activeBlock)"
      :can-undo="canUndo"
      :can-redo="canRedo"
      :uploading="uploading > 0"
      :compact="compact"
      @undo="applyHistory(history.undo())"
      @redo="applyHistory(history.redo())"
      @type="convertActive"
      @mark="toggleMark"
      @link="openLink"
      @insert="openInsertMenu($event)"
      @actions="openActions(activeId ?? blocks.at(-1)?.id, undefined, $event)"
      @upload="pickFiles"
    />

    <div v-if="uploading || failedUploads.length" class="flex w-full flex-col gap-2 px-4 pt-3 sm:px-8" aria-live="polite">
      <Message v-if="uploading" severity="info" :closable="false">正在上传 {{ uploading }} 个文件，可继续编辑…</Message>
      <Message v-if="failedUploads.length" severity="error" :closable="false">
        <div class="flex flex-wrap items-center gap-2">
          <span>{{ failedUploads.length }} 个文件上传失败，内容未改动。</span>
          <Button label="重试" icon="pi pi-replay" size="small" text @click="retryUploads" />
          <Button label="忽略" size="small" text severity="secondary" @click="failedUploads = []" />
        </div>
      </Message>
    </div>

    <div
      class="md-content flex w-full flex-1 flex-col px-4 pt-6 pb-[max(6rem,env(safe-area-inset-bottom))] sm:pr-8 sm:pl-14"
      @contextmenu="onContextMenu"
      @touchstart.passive="onTouchStart"
      @touchmove.passive="onTouchMove"
      @touchend="cancelPress"
      @touchcancel="cancelPress"
    >
      <div
        v-for="block in blocks"
        :key="block.id"
        :data-block-id="block.id"
        class="md-block group relative"
        :class="{ 'is-active': block.id === activeId }"
      >
        <Button
          icon="pi pi-ellipsis-v"
          text
          rounded
          size="small"
          severity="secondary"
          class="md-handle"
          aria-label="块操作"
          title="块操作"
          @mousedown.prevent
          @click="openActions(block.id, $event)"
        />

        <EditableSurface
          v-if="block.kind === 'paragraph'"
          :ref="(value) => setRef(block.id, value)"
          tag="p"
          :source="block.source"
          :render="inlineHtml"
          :read="readInline"
          label="正文段落"
          :placeholder="blocks.length === 1 || block.id === activeId ? '输入正文，或输入 / 插入内容' : ''"
          :class="{ 'is-empty': !block.source }"
          @change="onSurfaceChange(block, $event)"
          @keydown="onTextKeydown($event, block)"
        />
        <EditableSurface
          v-else-if="block.kind === 'heading'"
          :ref="(value) => setRef(block.id, value)"
          :tag="`h${headingLevel(block)}`"
          :source="block.source"
          :render="renderHeading"
          :read="headingReader(block)"
          :label="`标题 ${headingLevel(block)}`"
          :placeholder="`标题 ${headingLevel(block)}`"
          :class="{ 'is-empty': !parseHeading(block.source)?.text }"
          @change="onSurfaceChange(block, $event)"
          @keydown="onTextKeydown($event, block)"
        />
        <EditableSurface
          v-else-if="block.kind === 'blockquote'"
          :ref="(value) => setRef(block.id, value)"
          tag="blockquote"
          :source="block.source"
          :render="renderQuote"
          :read="readQuoteSurface"
          label="引用"
          @change="onSurfaceChange(block, $event)"
          @keydown="onTextKeydown($event, block)"
        />
        <EditableSurface
          v-else-if="block.kind === 'list'"
          :ref="(value) => setRef(block.id, value)"
          class="md-list"
          :source="block.source"
          :render="renderList"
          :read="listReader(block)"
          label="列表"
          @change="onSurfaceChange(block, $event)"
          @keydown="onListKeydown($event, block)"
        />
        <EditorCodeBlock
          v-else-if="block.kind === 'code'"
          :ref="(value) => setRef(block.id, value)"
          :source="block.source"
          @change="setSource(block, $event)"
          @exit="exitBlock(block)"
          @remove="removeBlock(block.id)"
          @navigate="moveFocus(block.id, $event === 'up' ? -1 : 1)"
        />
        <EditorTable
          v-else-if="block.kind === 'table'"
          :ref="(value) => setRef(block.id, value)"
          :source="block.source"
          @change="setSource(block, $event)"
          @exit="exitBlock(block)"
          @remove="removeBlock(block.id)"
          @navigate="moveFocus(block.id, $event === 'up' ? -1 : 1)"
        />
        <figure
          v-else-if="block.kind === 'image'"
          :ref="(value) => setRef(block.id, value)"
          tabindex="0"
          class="md-image"
          :aria-label="`图片：${imageOf(block).alt || imageOf(block).url}`"
          @keydown="onObjectKeydown($event, block)"
          @dblclick="openActions(block.id)"
        >
          <img :src="imageOf(block).url" :alt="imageOf(block).alt" loading="lazy" />
          <figcaption>{{ imageOf(block).alt || "（无替代文本）" }}</figcaption>
        </figure>
        <div
          v-else-if="block.kind === 'thematic-break'"
          :ref="(value) => setRef(block.id, value)"
          tabindex="0"
          role="separator"
          aria-label="分割线"
          class="md-rule"
          @keydown="onObjectKeydown($event, block)"
        >
          <hr />
        </div>
        <div
          v-else
          :ref="(value) => setRef(block.id, value)"
          tabindex="0"
          class="md-raw"
          :aria-label="`${rawLabel(block.source)}，按 Enter 编辑源码`"
          @keydown="onObjectKeydown($event, block)"
          @dblclick="openRaw(block.id)"
        >
          <div class="flex items-center justify-between gap-2">
            <span class="text-xs font-medium text-[var(--p-text-muted-color)]"><i class="pi pi-file-edit mr-1 text-xs" />{{ rawLabel(block.source) }}</span>
            <Button label="编辑源码" icon="pi pi-pencil" size="small" text class="min-h-11 sm:min-h-8" @click="openRaw(block.id)" />
          </div>
          <pre>{{ rawPreview(block.source) }}</pre>
        </div>
      </div>
      <div class="min-h-24 flex-1 cursor-text" aria-hidden="true" @click="focusBlock(blocks.at(-1)!.id)" />
    </div>

    <div
      v-if="slash.open && slashItems.length"
      class="md-floating absolute z-20 w-64"
      :style="{ top: `${slash.top}px`, left: `${slash.left}px` }"
    >
      <SlashMenu :items="slashItems" :highlighted="slash.highlighted" @select="chooseInsert" />
    </div>

    <div
      v-if="bubble.visible"
      class="md-floating md-bubble absolute z-20 flex items-center gap-0.5"
      :style="{ top: `${bubble.top}px`, left: `${bubble.left}px` }"
      role="toolbar"
      aria-label="文本格式"
    >
      <Button text size="small" severity="secondary" aria-label="加粗" title="加粗" @mousedown.prevent @click="toggleMark('bold')"><span class="font-bold">B</span></Button>
      <Button text size="small" severity="secondary" aria-label="斜体" title="斜体" @mousedown.prevent @click="toggleMark('italic')"><span class="font-serif italic">I</span></Button>
      <Button text size="small" severity="secondary" aria-label="删除线" title="删除线" @mousedown.prevent @click="toggleMark('strike')"><span class="line-through">S</span></Button>
      <Button text size="small" severity="secondary" aria-label="行内代码" title="行内代码" @mousedown.prevent @click="toggleMark('code')"><span class="font-mono text-xs">&lt;/&gt;</span></Button>
      <Button icon="pi pi-link" text size="small" severity="secondary" aria-label="链接" title="链接" @mousedown.prevent @click="openLink" />
    </div>

    <input ref="fileInput" type="file" class="hidden" @change="onFilesPicked" />
  </section>

  <ContextMenu ref="contextMenu" :model="contextItems" />
  <Popover ref="insertPopover">
    <div class="w-64"><SlashMenu :items="INSERT_ITEMS" @select="chooseInsert" /></div>
  </Popover>
  <Drawer v-model:visible="insertMenu.drawer" position="bottom" header="插入内容" class="md-sheet !h-auto !max-h-[80dvh]">
    <SlashMenu :items="INSERT_ITEMS" @select="chooseInsert" />
  </Drawer>

  <Popover ref="actionsPopover">
    <BlockInspector
      v-if="actionsBlock"
      :block="actionsBlock"
      :index="indexOf(actionsBlock.id)"
      :count="blocks.length"
      :uploading="uploading > 0"
      @convert="onAction(() => convertActive($event))"
      @move="(delta) => onAction(() => moveBlock(actions.id, delta))"
      @duplicate="onAction(() => duplicateBlock(actions.id))"
      @remove="onAction(() => removeBlock(actions.id))"
      @insert="onAction(() => openInsertMenu(undefined, actions.id))"
      @source="onAction(() => openRaw(actions.id))"
      @image="applyImage"
      @replace="pickFiles('replace')"
    />
  </Popover>
  <Drawer v-model:visible="actions.drawer" position="bottom" header="块操作" class="md-sheet !h-auto !max-h-[85dvh]">
    <BlockInspector
      v-if="actionsBlock"
      :block="actionsBlock"
      :index="indexOf(actionsBlock.id)"
      :count="blocks.length"
      :uploading="uploading > 0"
      @convert="onAction(() => convertActive($event))"
      @move="(delta) => onAction(() => moveBlock(actions.id, delta))"
      @duplicate="onAction(() => duplicateBlock(actions.id))"
      @remove="onAction(() => removeBlock(actions.id))"
      @insert="onAction(() => openInsertMenu(undefined, actions.id))"
      @source="onAction(() => openRaw(actions.id))"
      @image="applyImage"
      @replace="pickFiles('replace')"
    />
  </Drawer>

  <Dialog
    v-model:visible="raw.visible"
    modal
    maximizable
    header="编辑 Markdown 源码"
    class="w-[min(48rem,calc(100vw-2rem))]"
    @hide="onRawHide"
  >
    <p class="mt-0 text-sm text-[var(--p-text-muted-color)]">
      站点扩展语法（提示框、折叠、数学公式、视频、文件树等）在这里按原文编辑，保存时只替换这一块。
    </p>
    <Textarea v-model="raw.value" auto-resize rows="10" spellcheck="false" aria-label="Markdown 源码" class="w-full font-mono text-sm" />
    <template #footer>
      <Button label="取消" text severity="secondary" @click="raw.visible = false" />
      <Button label="应用" icon="pi pi-check" @click="saveRaw" />
    </template>
  </Dialog>

  <EditorLinkDialog
    v-model:visible="link.visible"
    :value="link.value"
    :editing="link.editing"
    @submit="applyLink"
    @remove="removeLink"
    @close="onLinkClose"
  />
</template>
