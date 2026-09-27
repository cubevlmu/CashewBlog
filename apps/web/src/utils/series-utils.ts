import type { SeriesStatus, SeriesSummaryDto } from "@/lib/api/types";
import type { PostDetailView } from "@/lib/content/posts";

export interface SeriesPostRef {
	slug: string;
	title: string;
}

export interface SeriesContext {
	slug: string;
	title: string;
	status: SeriesStatus;
	/** 系列内文章，按阅读顺序 */
	posts: SeriesPostRef[];
	total: number;
}

export interface SeriesPostContext extends SeriesContext {
	/** 当前文章在系列中的 1-based 位置 */
	index: number;
	prev: SeriesPostRef | null;
	next: SeriesPostRef | null;
}

/**
 * 文章所在系列的阅读上下文。`seriesPosts` 由后端按系列顺序返回；
 * 当前文章不在其中（数据不一致）时不生成上下文，避免死链。
 */
export function buildSeriesPostContext(
	post: Pick<PostDetailView, "slug" | "series" | "seriesPosts">,
	catalog: readonly SeriesSummaryDto[],
): SeriesPostContext | null {
	if (!post.series) return null;
	const posts = post.seriesPosts.map(({ slug, title }) => ({ slug, title }));
	const position = posts.findIndex((ref) => ref.slug === post.slug);
	if (position < 0) return null;
	const summary = catalog.find((s) => s.slug === post.series?.slug);
	return {
		slug: post.series.slug,
		title: post.series.title,
		status: summary?.status ?? "ongoing",
		posts,
		total: posts.length,
		index: position + 1,
		prev: position > 0 ? posts[position - 1] : null,
		next: position < posts.length - 1 ? posts[position + 1] : null,
	};
}

/**
 * 从系列总览 Markdown 提取纯文本摘要（供系列索引页大卡片展示）。
 * 只做轻量清洗：去代码块/图片/标题标记/列表符号/强调符/HTML，
 * 链接保留锚文本；按词边界截断并追加省略号。
 */
export function excerptFromMarkdown(markdown: string, maxChars = 160): string {
	const text = markdown
		.replace(/```[\s\S]*?```/g, " ")
		.replace(/`([^`]*)`/g, "$1")
		.replace(/!\[[^\]]*\]\([^)]*\)/g, "")
		.replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
		.replace(/^\s{0,3}#{1,6}\s+/gm, "")
		.replace(/^\s{0,3}>+\s?/gm, "")
		.replace(/^\s*[-*+]\s+/gm, "")
		.replace(/^\s*\d+\.\s+/gm, "")
		.replace(/[*_~]{1,3}([^*_~]+)[*_~]{1,3}/g, "$1")
		.replace(/<[^>]+>/g, "")
		.replace(/\s+/g, " ")
		.trim();

	if (text.length <= maxChars) return text;
	const cut = text.slice(0, maxChars);
	const lastSpace = cut.lastIndexOf(" ");
	return `${(lastSpace > 0 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}
