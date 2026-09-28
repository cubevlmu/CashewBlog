// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import {
  applyInlineShortcut,
  caretAtEnd,
  caretAtStart,
  listHtml,
  placeRange,
  quoteHtml,
  readInline,
  readList,
  readListSurface,
  readQuote,
  splitAtCaret,
} from "../src/editor/dom";
import { inlineHtml } from "../src/editor/inline-markdown";
import { emptyList, parseList, parseQuote, serializeList, serializeQuote } from "../src/editor/markdown-blocks";

function surface(html: string) {
  const element = document.createElement("div");
  element.contentEditable = "true";
  element.innerHTML = html;
  document.body.replaceChildren(element);
  return element;
}
function caret(node: Node, offset: number) {
  const range = document.createRange();
  range.setStart(node, offset);
  range.collapse(true);
  placeRange(range);
}

describe("editor DOM layer", () => {
  it("reads rendered inline Markdown back unchanged", () => {
    for (const source of [
      "普通 **加粗** 与 *斜体* 和 ~~删除~~ 以及 `代码`",
      '[链接](https://example.com "标题") 与 $x^2$ 和 :badge[新]{type=tip}',
      "一\n二\\\n三",
      "![图 w-50%](/a.png) 后文",
    ]) {
      expect(readInline(surface(inlineHtml(source)))).toBe(source);
    }
  });

  it("reads browser formatting markup and drops placeholders", () => {
    const element = surface('<b>a</b> b <i>c</i> <span style="font-weight: bold">d</span> e​<br>');
    expect(readInline(element)).toBe("**a** b *c* **d** e");
  });

  it("escapes typed block syntax at line starts", () => {
    expect(readInline(surface("# 不是标题"))).toBe("\\# 不是标题");
    expect(readInline(surface("# 单元格"), false)).toBe("# 单元格");
  });

  it("round trips lists, tasks and nesting through the DOM", () => {
    for (const source of ["- a\n  - b\n- c", "3. x\n4. y", "- [ ] 待办\n- [x] 完成"]) {
      const element = surface(listHtml(parseList(source)!));
      expect(serializeList(readListSurface(element, emptyList(false, false)))).toBe(source);
    }
    const element = surface(listHtml(parseList("- [ ] a")!));
    element.querySelector<HTMLInputElement>("input")!.checked = true;
    expect(serializeList(readList(element.querySelector("ul")!))).toBe("- [x] a");
  });

  it("tolerates text the browser left outside list items", () => {
    const element = surface("孤立文本");
    expect(serializeList(readListSurface(element, emptyList(false, false)))).toBe("- 孤立文本");
  });

  it("round trips quotes through the DOM", () => {
    const source = "> 一\n> 二\n>\n> 三";
    expect(serializeQuote(readQuote(surface(quoteHtml(parseQuote(source)!))))).toBe(source);
  });

  it("splits inline content at the caret keeping marks", () => {
    const element = surface("<strong>加粗文本</strong>后文");
    caret(element.querySelector("strong")!.firstChild!, 2);
    expect(splitAtCaret(element)).toEqual({ before: "**加粗**", after: "**文本**后文" });
  });

  it("detects the caret at the edges", () => {
    const element = surface("abc");
    caret(element.firstChild!, 0);
    expect(caretAtStart(element)).toBe(true);
    expect(caretAtEnd(element)).toBe(false);
    caret(element.firstChild!, 3);
    expect(caretAtEnd(element)).toBe(true);
  });

  it("turns typed **text** into a mark", () => {
    const element = surface("说 **重点**");
    caret(element.firstChild!, element.firstChild!.textContent!.length);
    expect(applyInlineShortcut(element)).toBe(true);
    expect(readInline(element)).toBe("说 **重点**");
    expect(element.querySelector("strong")?.textContent).toBe("重点");
  });
});
