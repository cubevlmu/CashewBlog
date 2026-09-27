import { getPostUrlBySlug } from "@utils/url-utils";
import MarkdownIt from "markdown-it";
import sanitizeHtml from "sanitize-html";
import type { FeedPostDto } from "@/lib/api/types";

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

export function stripInvalidXmlChars(str: string): string {
	return str.replace(
		// biome-ignore lint/suspicious/noControlCharactersInRegex: https://www.w3.org/TR/xml/#charsets
		/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F\uFDD0-\uFDEF\uFFFE\uFFFF]/g,
		"",
	);
}

/** RSS items from `/api/feed` (Published posts only, newest first). */
export function toFeedItems(posts: FeedPostDto[], site: URL): FeedPostItem[] {
	return posts.map((post) => {
		const contentHtml = sanitizeHtml(
			parser.render(stripInvalidXmlChars(post.contentMarkdown)),
			{ allowedTags: sanitizeHtml.defaults.allowedTags.concat(["img"]) },
		);
		return {
			id: post.id,
			title: post.title,
			link: new URL(getPostUrlBySlug(post.slug), site).href,
			pubDate: new Date(post.publishedAt),
			updated: new Date(post.updatedAt),
			description: post.description,
			contentHtml,
			category: post.category?.name,
			tags: post.tags.map((tag) => tag.name),
		};
	});
}
