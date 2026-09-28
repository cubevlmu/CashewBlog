import { describe, expect, it } from "vitest";
import { isDateField, isCardCollection, summarizeValue } from "../src/components/settings-fields";

describe("settings field presentation", () => {
  it("recognizes date fields and editable card collections", () => {
    expect(isDateField("general.siteStartDate")).toBe(true);
    expect(isCardCollection("profile.links")).toBe(true);
  });

  it("summarizes card data for compact previews", () => {
    expect(summarizeValue({ name: "GitHub", url: "https://github.com" })).toBe("GitHub · https://github.com");
  });
});
