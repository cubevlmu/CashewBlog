/**
 * CashewBlog public REST DTOs (see docs/api.md at the repository root).
 * Timestamps are ISO-8601 UTC strings; the adapters in `./posts.ts` turn them
 * into `Date` objects for the view layer.
 */

export type PostStatus = "draft" | "published" | "private";

export interface MediaRefDto {
	url: string;
	thumbUrl: string | null;
	width: number | null;
	height: number | null;
	alt: string | null;
}

export interface TaxonomyRefDto {
	name: string;
	slug: string;
}

export interface SeriesRefDto {
	title: string;
	slug: string;
	order: number | null;
}

export interface PostSummaryDto {
	id: string;
	slug: string;
	title: string;
	description: string;
	cover: MediaRefDto | null;
	category: TaxonomyRefDto | null;
	tags: TaxonomyRefDto[];
	series: SeriesRefDto | null;
	isPinned: boolean;
	publishedAt: string;
	updatedAt: string;
	wordCount: number;
	viewCount: number;
}

export interface PostLinkDto {
	slug: string;
	title: string;
}

export interface SeriesPostDto {
	slug: string;
	title: string;
	order: number | null;
}

export interface PostDetailDto extends PostSummaryDto {
	status: PostStatus;
	contentMarkdown: string;
	seoTitle: string;
	seoDescription: string;
	previous: PostLinkDto | null;
	next: PostLinkDto | null;
	seriesPosts: SeriesPostDto[];
}

export interface FeedPostDto extends PostSummaryDto {
	contentMarkdown: string;
}

export interface PagedDto<T> {
	items: T[];
	page: number;
	pageSize: number;
	totalItems: number;
	totalPages: number;
}

export interface CategorySummaryDto {
	name: string;
	slug: string;
	count: number;
}

export type TagSummaryDto = CategorySummaryDto;

export type SeriesStatus = "ongoing" | "completed";

export interface SeriesSummaryDto {
	title: string;
	slug: string;
	/** Markdown overview (optional). */
	description: string | null;
	status: SeriesStatus;
	/** Published posts in the series. */
	count: number;
	defaultCategory: TaxonomyRefDto | null;
	latestPublishedAt: string | null;
}

export interface SeriesDetailDto extends SeriesSummaryDto {
	/** Published posts in reading order. */
	posts: PostSummaryDto[];
}

export interface SearchHitDto {
	slug: string;
	/** Title with server-escaped `<mark>` highlights. */
	titleHtml: string;
	/** Snippet with server-escaped `<mark>` highlights. */
	snippetHtml: string;
	matchedTags: string[];
	publishedAt: string;
}

export interface SearchResponseDto {
	query: string;
	items: SearchHitDto[];
	page: number;
	totalItems: number;
}

export type CustomPageLayout = "default" | "wide" | "fullWidth";

export interface CustomPageDto {
	title: string;
	slug: string;
	contentHtml: string;
	customCss: string | null;
	layout: CustomPageLayout;
	createdAt: string;
	updatedAt: string;
}

export interface SitemapDto {
	posts: { slug: string; updatedAt: string }[];
	pages: { slug: string; updatedAt: string }[];
	categories: string[];
	tags: string[];
	series: string[];
}

export interface SiteStatsDto {
	postCount: number;
	totalWords: number;
	totalViews: number;
	siteStartDate: string | null;
	lastUpdatedAt: string | null;
}

export interface SiteBootstrapDto {
	settings: import("../site/settings").PublicSiteSettings;
	stats: SiteStatsDto;
	categories: CategorySummaryDto[];
	tags: TagSummaryDto[];
	series: SeriesSummaryDto[];
	recentPosts: { slug: string; title: string; publishedAt: string }[];
	pages: { title: string; slug: string }[];
	version: string;
}
