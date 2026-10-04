import { describe, expect, it } from "vitest";
import { Hct, hexFromArgb } from "@material/material-color-utilities";
import { groupFields, isWideField, normalizePath, type Value } from "../src/components/settings-fields";
import { hueFromHex, seedHex, themeSwatches } from "../src/theme-colors";

const appearance: Record<string, Value> = {
  themeHue: 315,
  themeStyle: "tonalSpot",
  themeSpec: "2025",
  defaultMode: "system",
  allowModeSwitch: true,
  backgroundMode: "banner",
  texture: { preset: "none", opacity: 0.12, allowMotion: true },
  topAppBarAlign: "center",
  progressIndicatorStyle: "dual",
  postList: { layout: "list", cover: "right", cardWidth: "regular" },
};

describe("settings layout", () => {
  it("groups a section into configured panels and one panel per nested object", () => {
    expect(groupFields("appearance", appearance).map((group) => [group.title, group.fields])).toEqual([
      ["主题色", ["themeHue", "themeStyle", "themeSpec"]],
      ["明暗模式", ["defaultMode", "allowModeSwitch"]],
      ["页面布局", ["backgroundMode", "topAppBarAlign", "progressIndicatorStyle"]],
      ["纹理", ["texture"]],
      ["文章列表", ["postList"]],
    ]);
  });

  it("puts an object's enable switch in its group header", () => {
    const groups = groupFields("banner", {
      desktop: [],
      mobile: [],
      position: "center",
      height: "default",
      dim: { enable: true, opacity: 0.24 },
      waves: true,
    });
    expect(groups.find((group) => group.id === "dim")).toMatchObject({ object: "dim", toggle: true, title: "遮罩" });
    expect(groupFields("banner.dim", { enable: true, opacity: 0.24 }, ["enable"])).toEqual([
      { id: "basic", title: "", fields: ["opacity"] },
    ]);
  });

  it("collects leftover fields and hides navigation ids", () => {
    expect(groupFields("analytics", { umami: { enable: false, websiteId: "" } }).map((group) => group.id)).toEqual(["umami"]);
    // Below the section root, lists stay in the field grid as full-width rows.
    expect(groupFields("navigation.0", { id: "x", label: "首页", children: [] }).map((group) => group.fields)).toEqual([
      ["label", "children"],
    ]);
  });

  it("normalizes collection indices and spots wide fields", () => {
    expect(normalizePath("sidebar.widgets.3.pages")).toBe("sidebar.widgets.*.pages");
    expect(isWideField("footer.html")).toBe(true);
    expect(isWideField("general.keywords")).toBe(true);
    expect(isWideField("general.siteName")).toBe(false);
  });
});

describe("theme colours", () => {
  it("uses the public site's seed (HCT chroma 60, tone 50)", () => {
    expect(seedHex(315)).toBe(hexFromArgb(Hct.from(315, 60, 50).toInt()));
  });

  it("keeps only the hue of a picked colour", () => {
    for (const hue of [0, 45, 150, 250, 315]) expect(Math.abs(hueFromHex(seedHex(hue)) - hue)).toBeLessThanOrEqual(1);
    expect(hueFromHex("ff0000")).toBe(hueFromHex("#ff0000"));
  });

  it("derives different palettes for light and dark", () => {
    const light = themeSwatches(250, "tonalSpot", "2025", false);
    const dark = themeSwatches(250, "tonalSpot", "2025", true);
    expect(light.primary).toMatch(/^#[0-9a-f]{6}$/);
    expect(light.primary).not.toBe(dark.primary);
  });
});
