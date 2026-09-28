import { describe, expect, it } from "vitest";
import { markdownExcerpt, parseMarkdown, rawLabel, serializeMarkdown } from "../src/editor/markdown-document";

const kinds = (source: string) => parseMarkdown(source).document.blocks.map((block) => block.kind);
const roundTrip = (source: string) => serializeMarkdown(parseMarkdown(source).document);

describe("markdown document", () => {
  it("splits common blocks and round trips them unchanged", () => {
    const source = [
      "# 标题",
      "正文 **加粗**，第二行\n继续。",
      "- 一\n- 二\n  - 嵌套",
      "1. 第一\n2. 第二",
      "* [ ] 待办\n* [x] 完成",
      "> 引用内容",
      "---",
      "```ts\nconst ok = true;\n```",
      "| A | B |\n| --- | :---: |\n| 1 | 2 |",
      "![封面 w-60%](/uploads/a.png)",
    ].join("\n\n");
    expect(kinds(source)).toEqual([
      "heading",
      "paragraph",
      "list",
      "list",
      "list",
      "blockquote",
      "thematic-break",
      "code",
      "table",
      "image",
    ]);
    expect(roundTrip(source)).toBe(source);
  });

  it("keeps blank lines inside fenced code in one block", () => {
    const source = "```js\nconst a = 1;\n\n\nconst b = 2;\n```\n\n后文";
    expect(kinds(source)).toEqual(["code", "paragraph"]);
    expect(roundTrip(source)).toBe(source);
  });

  it("preserves nested and spaced directives byte for byte as raw blocks", () => {
    const directive = ':::warning{title="注意"}\n外层\n\n:::note\n内层\n\n```md\n:::\n```\n:::\n\n仍在外层\n:::';
    const plume = "::: collapse expand\n- 标题\n\n  内容\n:::";
    const source = `${directive}\n\n${plume}\n\n::bilibili{bvid="BV1xx"}\n\n普通段落`;
    const blocks = parseMarkdown(source).document.blocks;
    expect(blocks.map((block) => block.kind)).toEqual(["raw", "raw", "raw", "paragraph"]);
    expect(blocks[0].source).toBe(directive);
    expect(blocks[1].source).toBe(plume);
    expect(roundTrip(source)).toBe(source);
  });

  it("keeps math, HTML, callouts, footnotes and complex lists raw", () => {
    const source = [
      "$$\na^2 + b^2\n\n= c^2\n$$",
      "<details>\n<summary>更多</summary>\n内容\n</details>",
      "> [!NOTE]\n> 提示",
      "[^1]: 脚注内容\n\n    续写段落",
      "- 项目\n\n  第二段落",
    ].join("\n\n");
    expect(kinds(source)).toEqual(["raw", "raw", "raw", "raw", "raw"]);
    expect(roundTrip(source)).toBe(source);
  });

  it("treats a paragraph followed by an underline as a setext heading", () => {
    expect(kinds("标题\n===\n\n正文")).toEqual(["heading", "paragraph"]);
  });

  it("does not split paragraphs on ordered markers other than 1", () => {
    expect(kinds("生于\n1986. 年")).toEqual(["paragraph"]);
    expect(kinds("前文\n- 列表")).toEqual(["paragraph", "list"]);
  });

  it("drops empty blocks and is stable across repeated round trips", () => {
    const source = "\n\n# A\n\n\n\n段落\n\n";
    const once = roundTrip(source);
    expect(once).toBe("# A\n\n段落");
    expect(roundTrip(once)).toBe(once);
    expect(parseMarkdown("   ").document.blocks).toEqual([]);
  });

  it("builds a summary from prose only", () => {
    const source = [
      "# 标题",
      "第一段 **加粗** 与 [链接](/a) ![图](/b.png)",
      "- 列表一\n- [ ] 待办",
      "```ts\nconst hidden = 1;\n```",
      "| A | B |\n| --- | --- |\n| 1 | 2 |",
      ":::note\n提示\n:::",
      "> 引用",
    ].join("\n\n");
    expect(markdownExcerpt(source)).toBe("第一段 加粗 与 链接 列表一 待办 引用");
    expect(markdownExcerpt("很长的段落".repeat(100), 10)).toHaveLength(10);
  });

  it("labels raw blocks for display", () => {
    expect(rawLabel(":::note\nx\n:::")).toBe("扩展容器 · note");
    expect(rawLabel("::: collapse\nx\n:::")).toBe("扩展容器 · collapse");
    expect(rawLabel("::youtube{id=1}")).toBe("扩展组件 · youtube");
    expect(rawLabel("$$\nx\n$$")).toBe("数学公式");
    expect(rawLabel("> [!TIP]\n> x")).toBe("提示框 · tip");
  });
});
