import { afterEach, describe, expect, it, vi } from "vitest";
import { buildUrl, request, toApiError } from "../src/api/http";

afterEach(() => vi.unstubAllGlobals());

describe("admin HTTP helpers", () => {
  it("builds encoded query strings and omits empty values", () => {
    expect(
      buildUrl("/api/admin/posts", {
        q: "中文标题",
        page: 2,
        status: "",
        trash: false,
      }),
    ).toBe(
      "/api/admin/posts?q=%E4%B8%AD%E6%96%87%E6%A0%87%E9%A2%98&page=2&trash=false",
    );
  });

  it("normalizes RFC 7807 validation errors", () => {
    const error = toApiError(422, {
      error: "validation_failed",
      title: "Invalid",
      detail: "Fix fields",
      errors: { title: ["Required"] },
    });
    expect(error.status).toBe(422);
    expect(error.code).toBe("validation_failed");
    expect(error.fieldErrors.title).toEqual(["Required"]);
  });

  it("sends multipart bodies intact without overriding the browser boundary", async () => {
    vi.stubGlobal("document", { cookie: "XSRF-TOKEN=current-token" });
    const fetch = vi.fn().mockResolvedValue(Response.json({ id: "uploaded" }));
    vi.stubGlobal("fetch", fetch);
    const body = new FormData();
    body.append("file", new Blob(["sample"]), "sample.txt");
    await request("POST", "/api/admin/media", { body });
    const options = fetch.mock.calls[0][1] as RequestInit;
    expect(options.body).toBe(body);
    expect(options.headers).not.toHaveProperty("Content-Type");
    expect(options.headers).toHaveProperty("X-XSRF-TOKEN", "current-token");
  });

  it("retries a stale CSRF token once with the refreshed cookie", async () => {
    const document = { cookie: "XSRF-TOKEN=old" };
    vi.stubGlobal("document", document);
    const tokens: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (path: string, options?: RequestInit) => {
        if (path.endsWith("/csrf")) {
          document.cookie = "XSRF-TOKEN=new";
          return Response.json({ token: "new" });
        }
        tokens.push(
          (options!.headers as Record<string, string>)["X-XSRF-TOKEN"],
        );
        return tokens.length === 1
          ? Response.json({ error: "csrf_invalid" }, { status: 400 })
          : Response.json({ id: "saved" });
      }),
    );
    await expect(
      request("PUT", "/api/admin/posts/id", { body: { title: "Saved" } }),
    ).resolves.toEqual({ id: "saved" });
    expect(tokens).toEqual(["old", "new"]);
  });
});
