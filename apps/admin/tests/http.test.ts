import { describe, expect, it } from "vitest";
import { buildUrl, toApiError } from "../src/api/http";

describe("admin HTTP helpers", () => {
  it("builds encoded query strings and omits empty values", () => {
    expect(buildUrl("/api/admin/posts", { q: "中文标题", page: 2, status: "", trash: false })).toBe(
      "/api/admin/posts?q=%E4%B8%AD%E6%96%87%E6%A0%87%E9%A2%98&page=2&trash=false",
    );
  });

  it("normalizes RFC 7807 validation errors", () => {
    const error = toApiError(422, { error: "validation_failed", title: "Invalid", detail: "Fix fields", errors: { title: ["Required"] } });
    expect(error.status).toBe(422);
    expect(error.code).toBe("validation_failed");
    expect(error.fieldErrors.title).toEqual(["Required"]);
  });
});
