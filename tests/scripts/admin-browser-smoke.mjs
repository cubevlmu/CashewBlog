// Run against a disposable local instance; creates and removes its own content.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(
  new URL("../../apps/web/package.json", import.meta.url),
);
const { chromium, expect } = require("@playwright/test");
const base = process.env.CASHEWBLOG_E2E_URL;
const password = process.env.CASHEWBLOG_E2E_PASSWORD;
if (
  !base ||
  !password ||
  !["127.0.0.1", "localhost"].includes(new URL(base).hostname)
)
  throw new Error(
    "Set CASHEWBLOG_E2E_URL to a disposable local gateway and CASHEWBLOG_E2E_PASSWORD.",
  );
const browser = await chromium.launch({
  channel: process.env.CASHEWBLOG_E2E_CHANNEL ?? "chrome",
});
const context = await browser.newContext();
const anonymous = await browser.newContext();
const page = await context.newPage();
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
const suffix = Date.now().toString(36);
let postId, categoryId, pageId, mediaId;
async function api(method, path, data) {
  const token = (await context.cookies()).find(
    (c) => c.name === "XSRF-TOKEN",
  )?.value;
  return context.request.fetch(base + path, {
    method,
    data,
    headers: token ? { "X-XSRF-TOKEN": decodeURIComponent(token) } : {},
  });
}
try {
  await page.goto(base + "/admin/login");
  await page.getByLabel("管理员密码", { exact: true }).fill(password);
  await page.getByRole("button", { name: "登录", exact: true }).click();
  await expect(page.getByText("文章总数", { exact: true })).toBeVisible();
  await page.goto(base + "/admin/categories");
  await page.getByRole("button", { name: "新建", exact: true }).click();
  await page.getByLabel("名称", { exact: true }).fill("验收分类-" + suffix);
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await expect(
    page.getByRole("cell", { name: "验收分类-" + suffix, exact: true }).first(),
  ).toBeVisible();
  categoryId = (await (await api("GET", "/api/admin/categories")).json()).find(
    (c) => c.name === "验收分类-" + suffix,
  ).id;
  await page.goto(base + "/admin/posts/new");
  await page.getByLabel("标题", { exact: true }).fill("验收文章-" + suffix);
  await page.getByRole("button", { name: "Markdown", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Markdown 正文", exact: true })
    .fill("# 原始正文");
  await page.getByRole("button", { name: "发布", exact: true }).click();
  await expect(page.getByText("已发布", { exact: true })).toBeVisible();
  postId = page.url().split("/").at(-1);
  const dto = await (await api("GET", "/api/admin/posts/" + postId)).json();
  assert.equal(dto.status, "published");
  await page.getByRole("button", { name: "Markdown", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Markdown 正文", exact: true })
    .fill("# 未发布的工作副本");
  await page.evaluate(() => window.dispatchEvent(new Event("blur")));
  await expect(
    page.getByRole("status").filter({ hasText: "正文已自动保存" }),
  ).toBeVisible();
  const publicPath = "/api/posts/" + encodeURIComponent(dto.slug);
  assert.match(
    (await (await anonymous.request.get(base + publicPath)).json())
      .contentMarkdown,
    /原始正文/,
  );
  assert.match(
    (await (await api("GET", publicPath + "?preview=true")).json())
      .contentMarkdown,
    /工作副本/,
  );
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "已保存" }),
  ).toBeVisible();
  assert.match(
    (await (await anonymous.request.get(base + publicPath)).json())
      .contentMarkdown,
    /工作副本/,
  );
  await page.getByRole("button", { name: "设为私密", exact: true }).click();
  await expect(page.getByText("私密", { exact: true })).toBeVisible();
  assert.equal((await anonymous.request.get(base + publicPath)).status(), 404);
  await page.getByRole("button", { name: "发布", exact: true }).click();
  await expect(page.getByText("已发布", { exact: true })).toBeVisible();
  assert.equal(
    (
      await anonymous.request.get(
        base + "/posts/" + encodeURIComponent(dto.slug) + "/",
      )
    ).status(),
    200,
  );
  await page.goto(base + "/admin/media");
  await page
    .locator("input[type=file]")
    .setInputFiles({
      name: suffix + ".txt",
      mimeType: "text/plain",
      buffer: Buffer.from("smoke attachment"),
    });
  await expect(
    page.getByRole("cell", { name: suffix + ".txt", exact: true }),
  ).toBeVisible();
  const media = (
    await (await api("GET", "/api/admin/media?q=" + suffix)).json()
  ).items[0];
  mediaId = media.id;
  await api("PUT", "/api/admin/posts/" + postId, {
    title: dto.title,
    contentMarkdown: "[附件](" + media.url + ")",
  });
  assert.equal(
    (await api("DELETE", "/api/admin/media/" + mediaId)).status(),
    409,
  );
  await page.goto(base + "/admin/pages/new");
  await page.getByLabel("标题", { exact: true }).fill("验收页面-" + suffix);
  await page.getByLabel("Slug", { exact: true }).fill("smoke/" + suffix);
  await expect(page.locator(".monaco-editor").first()).toBeVisible();
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await expect(page).not.toHaveURL(/pages\/new/);
  pageId = page.url().split("/").at(-1);
  await page.getByRole("button", { name: "预览", exact: true }).click();
  await expect(page.locator('iframe[title="页面预览"]')).toHaveAttribute(
    "sandbox",
    "",
  );
  assert.equal(
    (await anonymous.request.get(base + "/smoke/" + suffix + "/")).status(),
    200,
  );
  await page.goto(base + "/admin/settings");
  await expect(page.getByLabel("站点名称", { exact: true })).toBeVisible();
  await page.goto(base + "/admin/posts");
  const row = page.getByRole("row").filter({ hasText: dto.title });
  await row.getByRole("button", { name: "删除", exact: true }).click();
  await page.getByRole("button", { name: "确认删除", exact: true }).click();
  await expect(row).toHaveCount(0);
  await page.goto(base + "/admin/trash");
  await page
    .getByRole("row")
    .filter({ hasText: dto.title })
    .getByRole("button", { name: "恢复", exact: true })
    .click();
  await expect(
    page.getByRole("row").filter({ hasText: dto.title }),
  ).toHaveCount(0);
  for (const path of ["/", "/rss.xml", "/sitemap.xml"])
    assert.equal((await anonymous.request.get(base + path)).status(), 200);
  assert.deepEqual(errors, []);
  console.log(
    "PASS login, taxonomy, publish, working copy, private access, media references, Monaco, preview, trash, public routes",
  );
} finally {
  for (const [id, path] of [
    [pageId, "/api/admin/pages/"],
    [postId, "/api/admin/posts/"],
    [mediaId, "/api/admin/media/"],
    [categoryId, "/api/admin/categories/"],
  ]) {
    if (id) {
      const response = await api(
        "DELETE",
        path + id + (path.includes("/posts/") ? "/permanent" : ""),
      );
      if (!response.ok())
        console.error("Cleanup failed:", path, response.status());
    }
  }
  await browser.close();
}
