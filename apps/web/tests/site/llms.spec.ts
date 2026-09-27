import { expect, test } from "@playwright/test";

test.describe("LLMs.txt & AI-friendly Content Endpoints", () => {
	test("GET /llms.txt returns standard machine-readable directory and excludes encrypted posts", async ({
		page,
	}) => {
		const response = await page.goto("/llms.txt");
		expect(response).not.toBeNull();
		expect(response?.status()).toBe(200);

		const contentType = response?.headers()["content-type"] || "";
		expect(contentType).toContain("text/markdown");

		const text = await response?.text();
		expect(text).toBeDefined();

		// 验证基本元数据与核心章节
		expect(text).toContain("# Shirone");
		expect(text).toContain("## Core Pages");
		expect(text).toContain("- [Home](");
		expect(text).toContain("- [About](");
		expect(text).toContain("- [Archive](");

		// 验证公开文章目录索引
		expect(text).toContain("## Articles");
		expect(text).toContain("/posts/guide/");
		expect(text).toContain("/posts/markdown-enhancements/");

		// 验证全量正文链接
		expect(text).toContain("## Full Text Dump");
		expect(text).toContain("/llms-full.txt");

		// 严格安全隔离验证：加密文章与草稿绝对不可出现在 llms.txt 中
		expect(text).not.toContain("encrypted-demo");
		expect(text).not.toContain("This is a draft post");
	});

	test("GET /llms-full.txt concatenates public Markdown articles and strictly excludes encrypted contents", async ({
		page,
	}) => {
		const response = await page.goto("/llms-full.txt");
		expect(response).not.toBeNull();
		expect(response?.status()).toBe(200);

		const contentType = response?.headers()["content-type"] || "";
		expect(contentType).toContain("text/markdown");

		const text = await response?.text();
		expect(text).toBeDefined();

		// 验证全量正文头部
		expect(text).toContain("# Shirone - Full Content Archive");

		// 验证公开文章包含完整正文内容
		expect(text).toContain("## Shirone Markdown Enhancements");
		expect(text).toContain("## File Trees");
		expect(text).toContain("File Trees turn multi-level project structures");

		// 严格安全隔离验证：密码保护文章的密钥与正文绝对不存在
		expect(text).not.toContain("Encrypted Post Demo");
		expect(text).not.toContain("This content is password-protected");
		expect(text).not.toContain("shirone2026");
	});
});
