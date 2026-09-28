# PrimeVue 所见即所得 Markdown 编辑器 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Milkdown Crepe with a PrimeVue assembled WYSIWYG Markdown editor while preserving current Markdown, media upload, autosave, preview, and mobile/desktop behavior.

**Architecture:** Keep the existing `MarkdownEditor.vue` public interface and move editor internals into a small Markdown document model, a contenteditable editing surface, and PrimeVue command panels. Standard CommonMark/GFM blocks are editable; unsupported site directives are preserved as raw blocks and edited through a source dialog. The API and Astro renderer remain unchanged.

**Tech Stack:** Vue 3, TypeScript, PrimeVue 5, Vitest, existing `upload()`/media API, existing Tailwind utility setup.

**Spec:** `docs/superpowers/specs/2026-09-28-primevue-markdown-editor-design.md`

## Global Constraints

- Preserve `contentMarkdown` as the persisted format and keep existing `PostEditorView.vue` autosave/preview semantics.
- Preserve all current Crepe/CommonMark/GFM editing capabilities: headings, marks, links, lists, task lists, quotes, rules, code blocks, tables, images, shortcuts, paste/drop upload, undo/redo.
- Preserve unknown site extensions (admonitions, collapse, math, Mermaid, video, file tree, and future directives) byte-for-byte when not explicitly edited.
- Prefer PrimeVue components and existing utility classes; add only semantic editor CSS required for editing and responsive layout.
- Mobile controls must be touch reachable with at least 44px targets and must not rely on hover.
- Do not store image/file data as base64.
- The working tree has unrelated in-progress changes, including the current editor and admin package files; inspect their diffs before editing and preserve them.

## Review Focus

- Existing posts containing nested directives and fenced code must round-trip without loss; covered by `markdown-document` raw block tests.
- IME composition and external autosave updates must not replace active input; covered by editor model synchronization tests.
- Markdown pasted from outside must remain safe text and preserve links/images; covered by paste normalization tests.
- Mobile bottom sheets must expose every block action without hover; covered by responsive command rendering tests and manual device check.
- Upload failure must retain the selection/block and surface the existing error event; covered by upload interaction tests.

## Status — 2026-09-28

Done and verified: 49 admin unit tests (including happy-dom DOM tests) pass, `vue-tsc` and
`vite build` are clean, Milkdown is removed from `package.json`/lock, and a browser acceptance run
against a disposable instance passed (shortcuts, marks, lists/tasks/nesting, quote, code, slash
table, undo/redo, byte-for-byte extension round trip, raw source dialog, image upload, mobile
44px toolbar + block drawer, no horizontal scroll). `admin-browser-smoke.mjs` passes its admin
steps; it only trips on the Astro dev server's toolbar 504 (dev-only). Reviewed by the owner and
committed together with the PrimeVue 5 admin upgrade it depends on.

Implemented:

- `src/editor/inline-markdown.ts` — inline Markdown ⇄ runs, canonical serializer with escaping,
  atoms for math/directives/HTML/images/footnotes/entities/autolinks, HTML renderer.
- `src/editor/markdown-blocks.ts` — heading/quote/list/table/code/image models, table ops,
  line-start escaping.
- `src/editor/markdown-document.ts` — line scanner (fences, nested + Plume-style `::: name`
  directives, `$$`, HTML, lists, tables, setext) → blocks; raw fallback; `rawLabel`.
- `src/editor/editor-commands.ts` — block conversion, `/`/prefix/Enter shortcut rules, insert
  catalogue, bounded coalescing `EditHistory`.
- `src/editor/dom.ts` — DOM ⇄ Markdown readers, list/quote rendering, caret helpers, inline
  `**x**` shortcuts, inline code toggle.
- Components: `MarkdownEditor.vue` (the editor itself; same props/events/expose as before),
  `EditableSurface.vue`, `EditorToolbar.vue`, `SlashMenu.vue`, `BlockInspector.vue`,
  `EditorLinkDialog.vue`, `EditorTable.vue` (includes the table actions), `EditorCodeBlock.vue`,
  `editor.css`.
- Tests in `tests/` (vitest only includes `tests/**`): `markdown-document`, `markdown-inline`,
  `editor-commands`, `editor-dom` (happy-dom).
- Follow-up review: full-width writing area, "…" overflow menu on narrow toolbars, right-click
  context menu / long-press block drawer, reorganized post settings drawer, prose-only summary.
- Docs updated (00/01/07/14/15); browser smoke test locator now `.md-editor p.md-surface`.

Deviations from the task list: `MarkdownEditor.vue` is the editor (no wrapper); table actions live
in `EditorTable.vue`; the link editor is a Dialog; task lists are a `list` with checked items.

Remaining: a check on a real iOS/Android device (only emulated touch has been tested).

---

### Task 1: Markdown document model and round-trip tests

**Files:**
- Create: `apps/admin/src/editor/markdown-document.ts`
- Create: `apps/admin/src/editor/markdown-document.test.ts`
- Create: `apps/admin/src/editor/editor-types.ts`
- Modify: `apps/admin/package.json` only if a parser dependency is required and already present transitively is insufficient.

**Interfaces:**
- Produces `MarkdownDocument`, `MarkdownBlock`, `parseMarkdown(source: string): ParseResult`, `serializeMarkdown(document: MarkdownDocument): string`, and `insertMarkdownAtSelection(...)` for later editor tasks.
- `MarkdownBlock` kinds: `paragraph`, `heading`, `blockquote`, `list`, `task-list`, `code`, `table`, `image`, `thematic-break`, `raw`.
- `raw` stores exact source text and a display label; normal blocks store structured content plus source metadata needed for stable serialization.

- [ ] **Step 1: Write failing tests** for ordinary block parsing/serialization, GFM task lists and tables, fenced code language retention, image alt/width token retention, nested/custom directive raw preservation, malformed Markdown fallback to one raw block, and repeated parse/serialize stability.
- [ ] **Step 2: Run `pnpm --dir apps/admin test -- markdown-document.test.ts`** and verify the new tests fail because the model is absent.
- [ ] **Step 3: Implement the document types and parser/serializer** with a small deterministic block scanner. Recognize only the standard blocks needed by the editor; route unrecognized directive/container regions to `raw` without rewriting their text.
- [ ] **Step 4: Run the focused test file** and verify all round-trip assertions pass.
- [ ] **Step 5: Commit** with `feat(admin): add markdown document model`.

### Task 2: Editor command engine and contenteditable surface

**Files:**
- Create: `apps/admin/src/editor/editor-commands.ts`
- Create: `apps/admin/src/components/RichMarkdownEditor.vue`
- Create: `apps/admin/src/components/EditorBlock.vue`
- Create: `apps/admin/src/components/RawMarkdownBlock.vue`
- Create: `apps/admin/src/editor/editor-commands.test.ts`
- Modify: `apps/admin/src/editor/editor-types.ts`

**Interfaces:**
- Consumes Task 1 `MarkdownDocument` and `parseMarkdown`/`serializeMarkdown`.
- Produces `RichMarkdownEditor` with `modelValue`, `update:modelValue`, `error` and exposed `rememberSelection()`/`insert(markdown)` methods.
- Commands: `toggleMark`, `setBlockType`, `toggleList`, `indentList`, `outdentList`, `insertBlock`, `insertLink`, `insertImage`, `updateCodeLanguage`, `undo`, `redo`.

- [ ] **Step 1: Write failing command tests** for marks, heading/list conversion, quote/code insertion, link insertion, image/file Markdown insertion, undo/redo snapshots, and selection-aware `insert(markdown)`.
- [ ] **Step 2: Run the focused command tests** and verify failure.
- [ ] **Step 3: Implement the command engine** against the document model, keeping a bounded undo/redo snapshot stack and emitting serialized Markdown after every accepted change.
- [ ] **Step 4: Implement the contenteditable block renderer** with keyboard shortcuts (`Mod-b`, `Mod-i`, `Mod-k`, `Mod-z`, `Mod-Shift-z`), Markdown input rules, composition guards, safe external `modelValue` synchronization, and raw block source editing entry points.
- [ ] **Step 5: Run command and component tests** and verify model updates do not fire during IME composition until composition ends.
- [ ] **Step 6: Commit** with `feat(admin): add rich markdown editor core`.

### Task 3: PrimeVue toolbar, slash menu, inspectors, and responsive layout

**Files:**
- Create: `apps/admin/src/components/EditorToolbar.vue`
- Create: `apps/admin/src/components/SlashMenu.vue`
- Create: `apps/admin/src/components/BlockInspector.vue`
- Create: `apps/admin/src/components/EditorLinkPopover.vue`
- Create: `apps/admin/src/components/EditorTableActions.vue`
- Create: `apps/admin/src/components/editor.css` only for semantic editor rules and PrimeVue variable tokens.
- Modify: `apps/admin/src/components/RichMarkdownEditor.vue`
- Create: `apps/admin/src/components/editor-ui.test.ts`

**Interfaces:**
- Consumes the command interface from Task 2.
- Produces toolbar and menus that call commands without directly mutating Markdown strings.

- [ ] **Step 1: Write failing UI tests** for toolbar command dispatch, slash filtering/insertion, link popover submit/cancel, table row/column operations, raw block source dialog, and mobile command panel rendering.
- [ ] **Step 2: Run focused UI tests** and verify failure.
- [ ] **Step 3: Build the desktop PrimeVue UI** using `Toolbar`, `Button`, `ButtonGroup`, `Select`, `Popover`, `Menu`, `Dialog`, and `DataTable`-free table controls; keep all action labels and aria text in the existing admin locale style.
- [ ] **Step 4: Add responsive behavior**: horizontally scrollable 44px toolbar controls, touch-visible block action button, bottom `Drawer` for block actions/inspectors, safe-area padding, and horizontally scrollable tables on narrow viewports.
- [ ] **Step 5: Run UI tests and `pnpm --dir apps/admin type-check`**; fix accessibility/type errors until clean.
- [ ] **Step 6: Commit** with `feat(admin): add PrimeVue editor controls`.

### Task 4: Media upload, raw block editing, and MarkdownEditor compatibility wrapper

**Files:**
- Modify: `apps/admin/src/components/RichMarkdownEditor.vue`
- Modify: `apps/admin/src/components/RawMarkdownBlock.vue`
- Replace: `apps/admin/src/components/MarkdownEditor.vue`
- Modify: `apps/admin/src/components/editor-ui.test.ts`

**Interfaces:**
- Consumes existing `upload()` and `errorMessage()` from `apps/admin/src/state`.
- Preserves `MarkdownEditor.vue` props/events/exposed methods exactly so `PostEditorView.vue` remains source-compatible.

- [ ] **Step 1: Write failing upload tests** for image paste/drop, non-image file links, multi-file insertion order, selection restoration, upload failure, and media-library `insert()` calls.
- [ ] **Step 2: Run focused upload tests** and verify failure.
- [ ] **Step 3: Implement upload handling** with pending UI, no base64, restored selection, retryable failure state, and existing `error` emission.
- [ ] **Step 4: Implement raw block source dialog** so editing a raw block replaces only that block and preserves surrounding bytes when serialization fails.
- [ ] **Step 5: Make `MarkdownEditor.vue` a compatibility wrapper/re-export** around the new editor and run existing admin tests.
- [ ] **Step 6: Commit** with `feat(admin): preserve editor media and compatibility flows`.

### Task 5: Remove Milkdown and integrate with the post editor

**Files:**
- Modify: `apps/admin/package.json`
- Modify: `pnpm-lock.yaml`
- Modify: `apps/admin/src/views/PostEditorView.vue` only if import typing or editor sizing requires it.
- Delete: Milkdown-specific imports and styles from the replaced component.

- [ ] **Step 1: Run `pnpm --dir apps/admin build` before dependency removal** to establish the integration baseline.
- [ ] **Step 2: Remove `@milkdown/crepe` and `@milkdown/kit` from admin dependencies** and update the lock file with the repository's pnpm version.
- [ ] **Step 3: Run `pnpm --dir apps/admin type-check`, `pnpm --dir apps/admin test`, and `pnpm --dir apps/admin build`**; fix all failures.
- [ ] **Step 4: Manually verify new and existing posts, draft autosave, published working copy preview, media insertion, desktop keyboard use, and mobile touch use.**
- [ ] **Step 5: Commit** with `refactor(admin): replace Milkdown with PrimeVue editor`.

### Task 6: Final verification and index update

**Files:**
- Modify: `docs/api.md` only if implementation reveals a contract change (expected: no change).
- Modify: `docs/superpowers/specs/2026-09-28-primevue-markdown-editor-design.md` only for approved clarifications.

- [ ] **Step 1: Run `codegraph sync .`** after all source changes.
- [ ] **Step 2: Run the complete admin checks:** `pnpm --dir apps/admin type-check`, `pnpm --dir apps/admin test`, `pnpm --dir apps/admin build`.
- [ ] **Step 3: Run `git diff --check` and inspect the final diff for accidental custom CSS, API changes, or Milkdown references.**
- [ ] **Step 4: Commit any verification-only fixes** with the appropriate conventional scope.

