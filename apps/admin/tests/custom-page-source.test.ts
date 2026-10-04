import { describe, expect, it } from "vitest";
import { joinPageSource, splitPageSource } from "../src/custom-page-source";

describe("custom page source", () => {
  it("edits HTML and page CSS as one document", () => {
    const source = joinPageSource("<h1>关于</h1>", ".title { color: red; }");
    expect(source).toBe("<style>\n.title { color: red; }\n</style>\n\n<h1>关于</h1>");
    expect(splitPageSource(source)).toEqual({ contentHtml: "<h1>关于</h1>", customCss: ".title { color: red; }" });
  });

  it("collects every style block and drops empty ones", () => {
    expect(splitPageSource('<p>a</p><style media="screen">p { margin: 0 }</style><style> </style><style>h1{}</style>')).toEqual({
      contentHtml: "<p>a</p>",
      customCss: "p { margin: 0 }\n\nh1{}",
    });
  });

  it("keeps pages without CSS unchanged", () => {
    expect(joinPageSource("<p>x</p>", null)).toBe("<p>x</p>");
    expect(splitPageSource("<p>x</p>")).toEqual({ contentHtml: "<p>x</p>", customCss: null });
  });
});
