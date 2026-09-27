import { getPublishedInstant, getUpdatedInstant } from "@utils/content-date";
import { getSortedPosts } from "@utils/content-utils";
import { getPostUrl } from "@utils/url-utils";
import MarkdownIt from "markdown-it";
import sanitizeHtml from "sanitize-html";

const parser = new MarkdownIt();

export interface FeedPostItem {
	id: string;
	title: string;
	link: string;
	pubDate: Date;
	updated: Date;
	description: string;
	contentHtml: string;
	category?: string;
	tags: string[];
}

export function escapeXml(value: unknown): string {
	return String(value ?? "")
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;")
		.replaceAll("'", "&apos;");
}

export function cdata(value: string): string {
	return `<![CDATA[${value.replaceAll("]]>", "]]]]><![CDATA[>")}]]>`;
}

export function sanitizeMdxForFeed(raw: string): string {
	return raw
		.replace(/^import\s+[\s\S]*?['"][^'"]*['"];?\s*$/gm, "")
		.replace(
			/^export\s+(?:const|let|var|function|class|default)\s+[\s\S]*?;/gm,
			"",
		)
		.replace(/<[A-Z][A-Za-z0-9_]*(\s+[^>]*)?\/>/g, "")
		.replace(
			/<[A-Z][A-Za-z0-9_]*(\s+[^>]*)?>([\s\S]*?)<\/[A-Z][A-Za-z0-9_]*>/g,
			"$2",
		)
		.replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
		.trim();
}

export function stripInvalidXmlChars(str: string): string {
	return str.replace(
		// biome-ignore lint/suspicious/noControlCharactersInRegex: https://www.w3.org/TR/xml/#charsets
		/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F\uFDD0-\uFDEF\uFFFE\uFFFF]/g,
		"",
	);
}

export async function getFeedPosts(site: URL): Promise<FeedPostItem[]> {
	const blog = await getSortedPosts();

	return blog.map((post) => {
		const isMdx = post.filePath?.endsWith(".mdx") || post.id.endsWith(".mdx");
		const rawContent =
			typeof post.body === "string" ? post.body : String(post.body || "");
		const contentToRender = isMdx
			? sanitizeMdxForFeed(rawContent) || post.data.description || ""
			: rawContent;
		const cleanedContent = stripInvalidXmlChars(contentToRender);
		const contentHtml = sanitizeHtml(parser.render(cleanedContent), {
			allowedTags: sanitizeHtml.defaults.allowedTags.concat(["img"]),
		});

		const postUrl = new URL(getPostUrl(post), site).href;
		const pubDate = getPublishedInstant(post.data);
		const updated = getUpdatedInstant(post.data);

		return {
			id: post.id,
			title: post.data.title,
			link: postUrl,
			pubDate,
			updated,
			description: post.data.description || "",
			contentHtml,
			category: post.data.category || undefined,
			tags: post.data.tags || [],
		};
	});
}
