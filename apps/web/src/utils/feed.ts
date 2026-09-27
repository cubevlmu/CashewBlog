import I18nKey from "@i18n/i18nKey";
import { i18n } from "@i18n/translation";
import { getPublishedInstant, getUpdatedInstant } from "@utils/content-date";
import { getSortedPosts } from "@utils/content-utils";
import { isEncryptedPost } from "@utils/post-encryption";
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
	isEncrypted: boolean;
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
		const isEncrypted = isEncryptedPost(post.data);
		let contentHtml: string;

		if (isEncrypted) {
			const notice = i18n(I18nKey.postRssEncryptedNotice);
			contentHtml = `<p><em>🔒 ${notice}</em></p>`;
		} else {
			const isMdx = post.filePath?.endsWith(".mdx") || post.id.endsWith(".mdx");
			const rawContent =
				typeof post.body === "string" ? post.body : String(post.body || "");
			const contentToRender = isMdx
				? sanitizeMdxForFeed(rawContent) || post.data.description || ""
				: rawContent;
			const cleanedContent = stripInvalidXmlChars(contentToRender);
			contentHtml = sanitizeHtml(parser.render(cleanedContent), {
				allowedTags: sanitizeHtml.defaults.allowedTags.concat(["img"]),
			});
		}

		const postUrl = new URL(getPostUrl(post), site).href;
		const pubDate = getPublishedInstant(post.data);
		const updated = getUpdatedInstant(post.data);

		return {
			id: post.id,
			title: isEncrypted ? `🔒 ${post.data.title}` : post.data.title,
			link: postUrl,
			pubDate,
			updated,
			description:
				isEncrypted && post.data.hideHomeContent
					? i18n(I18nKey.postEncryptedSummary)
					: post.data.description || "",
			contentHtml,
			category: post.data.category || undefined,
			tags: post.data.tags || [],
			isEncrypted,
		};
	});
}

export interface BuildAtomXmlOptions {
	title: string;
	subtitle: string;
	lang: string;
	author: string;
	siteUrl: string;
	feedUrl: string;
	items: FeedPostItem[];
}

export function buildAtomXml({
	title,
	subtitle,
	lang,
	author,
	siteUrl,
	feedUrl,
	items,
}: BuildAtomXmlOptions): string {
	const latestUpdated = items.reduce(
		(latest, item) => (item.updated > latest ? item.updated : latest),
		new Date(0),
	);

	const entries = items
		.map(
			(item) => `  <entry>
    <title>${escapeXml(item.title)}</title>
    <link href="${escapeXml(item.link)}" rel="alternate" type="text/html"/>
    <id>${escapeXml(item.link)}</id>
    <published>${item.pubDate.toISOString()}</published>
    <updated>${item.updated.toISOString()}</updated>
    <summary>${escapeXml(item.description)}</summary>
    <content type="html">${cdata(item.contentHtml)}</content>
    <author><name>${escapeXml(author)}</name></author>${
			item.category
				? `
    <category term="${escapeXml(item.category)}"/>`
				: ""
		}
  </entry>`,
		)
		.join("\n");

	return `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom" xml:lang="${escapeXml(lang)}">
  <title>${escapeXml(title)}</title>
  <subtitle>${escapeXml(subtitle)}</subtitle>
  <link href="${escapeXml(siteUrl)}" rel="alternate" type="text/html"/>
  <link href="${escapeXml(feedUrl)}" rel="self" type="application/atom+xml"/>
  <id>${escapeXml(siteUrl)}</id>
  <updated>${latestUpdated.toISOString()}</updated>
${entries}
</feed>
`;
}
