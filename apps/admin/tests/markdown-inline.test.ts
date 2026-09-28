import { describe, expect, it } from "vitest";
import { inlineHtml, inlineText, parseInline, serializeInline } from "../src/editor/inline-markdown";
import {
  insertTableColumn,
  parseCode,
  parseList,
  parseTable,
  serializeCode,
  serializeHeading,
  serializeList,
  serializeQuote,
  serializeTable,
  textSource,
} from "../src/editor/markdown-blocks";

const roundTrip = (source: string) => serializeInline(parseInline(source));

describe("inline markdown", () => {
  it("round trips marks, links and nested emphasis", () => {
    for (const source of [
      "普通 **加粗** 与 *斜体* 和 ~~删除~~ 以及 `代码`",
      '[链接](https://example.com "标题")',
      "***强调斜体***",
      "**外 *内* 外**",
      "[**粗体链接**](/posts/a)",
    ]) {
      expect(roundTrip(source)).toBe(source);
    }
  });

  it("keeps unsupported inline syntax as atoms byte for byte", () => {
    const source =
      "行内 $E=mc^2$ 公式、:badge[新]{type=tip}、![图 w-50%](/a.png)、<kbd>Ctrl</kbd>、[^1]、&copy; 和 <https://x.dev>";
    const runs = parseInline(source);
    expect(runs.filter((run) => run.type === "atom").map((run) => (run.type === "atom" ? run.source : ""))).toEqual([
      "$E=mc^2$",
      ":badge[新]{type=tip}",
      "![图 w-50%](/a.png)",
      "<kbd>",
      "</kbd>",
      "[^1]",
      "&copy;",
      "<https://x.dev>",
    ]);
    expect(roundTrip(source)).toBe(source);
  });

  it("escapes literal characters that would otherwise become syntax", () => {
    const text = serializeInline([{ type: "text", text: "a*b_c $5 <div> [x](y)", marks: [], link: null }]);
    expect(text).toBe("a\\*b_c \\$5 \\<div> \\[x](y)");
    expect(parseInline(text)).toEqual([{ type: "text", text: "a*b_c $5 <div> [x](y)", marks: [], link: null }]);
    expect(roundTrip("2 \\* 3 = 6")).toBe("2 \\* 3 = 6");
  });

  it("moves whitespace outside emphasis delimiters", () => {
    expect(
      serializeInline([
        { type: "text", text: "加粗 ", marks: ["strong"], link: null },
        { type: "text", text: "后文", marks: [], link: null },
      ]),
    ).toBe("**加粗** 后文");
  });

  it("keeps soft breaks and normalizes hard breaks", () => {
    expect(roundTrip("一\n二\\\n三")).toBe("一\n二\\\n三");
    expect(roundTrip("a  \nb")).toBe("a\\\nb");
  });

  it("chooses a code fence longer than the backticks inside", () => {
    expect(serializeInline([{ type: "text", text: "a`b", marks: ["code"], link: null }])).toBe("``a`b``");
    expect(roundTrip("``a`b``")).toBe("``a`b``");
  });

  it("renders escaped HTML for the editing surface", () => {
    const html = inlineHtml("**a** <b>x</b>");
    expect(html).toContain("<strong>a</strong>");
    expect(html).not.toContain("<b>");
    expect(html).toContain('contenteditable="false"');
    expect(inlineHtml("一\n二")).toBe('一<br data-md-soft="">二');
    expect(inlineText("**a** [b](c)")).toBe("a b");
  });
});

describe("markdown block models", () => {
  it("round trips nested, ordered, task and loose lists", () => {
    for (const source of ["- a\n  - b\n- c", "3. x\n4. y", "- [ ] 待办\n- [x] 完成", "- a\n\n- b", "1. a\n   - b"]) {
      expect(serializeList(parseList(source)!)).toBe(source);
    }
    expect(parseList("- a\n\n  second paragraph")).toBeNull();
    expect(parseList("- ```js")).toBeNull();
  });

  it("round trips tables with alignment and escaped pipes", () => {
    const source = "| A | B |\n| :--- | ---: |\n| 1 \\| 2 | x |";
    const table = parseTable(source)!;
    expect(table.align).toEqual(["left", "right"]);
    expect(table.rows).toEqual([["1 | 2", "x"]]);
    expect(serializeTable(table)).toBe(source);
    expect(insertTableColumn(table, 1).header).toEqual(["A", "列 3", "B"]);
  });

  it("keeps fence style and lengthens fences around nested fences", () => {
    expect(serializeCode(parseCode("~~~py\nprint(1)\n~~~")!)).toBe("~~~py\nprint(1)\n~~~");
    expect(serializeCode({ fence: "```", language: "md", code: "```\nx\n```" })).toBe("````md\n```\nx\n```\n````");
  });

  it("escapes heading closers and block-like line starts", () => {
    expect(serializeHeading({ level: 2, text: "C#" })).toBe("## C#");
    expect(serializeHeading({ level: 1, text: "标题 #" })).toBe("# 标题 \\#");
    expect(textSource("# 不是标题\n- 不是列表\n1. 不是\n+ x")).toBe("\\# 不是标题\n\\- 不是列表\n1\\. 不是\n\\+ x");
    expect(serializeQuote(["一\n二", "三"])).toBe("> 一\n> 二\n>\n> 三");
  });
});
