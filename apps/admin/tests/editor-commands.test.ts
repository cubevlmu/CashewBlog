import { describe, expect, it } from "vitest";
import {
  EditHistory,
  blockType,
  convertBlock,
  enterRule,
  filterInsertItems,
  insertItemBlock,
  shortcutRule,
} from "../src/editor/editor-commands";
import { createBlock } from "../src/editor/markdown-document";

describe("block conversion", () => {
  it("converts between text block types keeping the content", () => {
    expect(convertBlock(createBlock("paragraph", "hello"), "h2").source).toBe("## hello");
    expect(convertBlock(createBlock("heading", "## hello"), "bullet").source).toBe("- hello");
    expect(convertBlock(createBlock("paragraph", "一\n二"), "ordered").source).toBe("1. 一\n2. 二");
    expect(convertBlock(createBlock("paragraph", "引用"), "blockquote").source).toBe("> 引用");
    expect(convertBlock(createBlock("blockquote", "> 引用"), "paragraph").source).toBe("引用");
  });

  it("retypes lists without flattening them", () => {
    expect(convertBlock(createBlock("list", "- a\n  - b"), "task").source).toBe("- [ ] a\n  - b");
    expect(convertBlock(createBlock("list", "- [x] a"), "ordered").source).toBe("1. a");
    expect(blockType(createBlock("list", "- [ ] a"))).toBe("task");
    expect(blockType(createBlock("heading", "### x"))).toBe("h3");
    expect(blockType(createBlock("raw", ":::note\n:::"))).toBeNull();
  });

  it("moves text in and out of code blocks as plain text", () => {
    expect(convertBlock(createBlock("paragraph", "**x**"), "code").source).toBe("```\nx\n```");
    expect(convertBlock(createBlock("code", "```ts\na*b\n```"), "paragraph").source).toBe("a\\*b");
  });
});

describe("markdown shortcuts", () => {
  it("recognizes block prefixes", () => {
    expect(shortcutRule("## 标题")).toEqual({ type: "h2", length: 3 });
    expect(shortcutRule("- [ ] ")).toEqual({ type: "task", length: 6 });
    expect(shortcutRule("[] ")).toEqual({ type: "task", length: 3 });
    expect(shortcutRule("* ")).toEqual({ type: "bullet", length: 2 });
    expect(shortcutRule("3. ")).toEqual({ type: "ordered", length: 3, start: 3 });
    expect(shortcutRule("> ")).toEqual({ type: "blockquote", length: 2 });
    expect(shortcutRule("#标签")).toBeNull();
  });

  it("completes fences, rules and math on Enter", () => {
    expect(enterRule("```ts")).toMatchObject({ kind: "code", source: "```ts\n\n```" });
    expect(enterRule("---")).toMatchObject({ kind: "thematic-break" });
    expect(enterRule("$$")).toMatchObject({ kind: "raw" });
    expect(enterRule("普通文字")).toBeNull();
  });

  it("filters and creates insert items", () => {
    expect(filterInsertItems("表").map((item) => item.key)).toContain("table");
    expect(filterInsertItems("mermaid").map((item) => item.key)).toEqual(["mermaid"]);
    expect(insertItemBlock("table")?.kind).toBe("table");
    expect(insertItemBlock("note")).toMatchObject({ kind: "raw", source: ":::note\n内容\n:::" });
    expect(insertItemBlock("image")).toBeNull();
  });
});

describe("edit history", () => {
  it("coalesces typing and restores snapshots", () => {
    let now = 0;
    const history = new EditHistory("a", 200, () => now);
    history.record("ab", true);
    now = 500;
    history.record("abc", true);
    expect(history.undo()).toBe("a");
    expect(history.redo()).toBe("abc");
    now = 5000;
    history.record("abcd", true);
    expect(history.undo()).toBe("abc");
    history.record("x");
    expect(history.canRedo).toBe(false);
  });

  it("keeps a bounded number of snapshots", () => {
    const history = new EditHistory("0", 2);
    history.record("1");
    history.record("2");
    history.record("3");
    expect(history.undo()).toBe("2");
    expect(history.undo()).toBe("1");
    expect(history.undo()).toBeNull();
  });
});
