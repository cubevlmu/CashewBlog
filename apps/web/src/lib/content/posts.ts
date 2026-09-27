import type {
	MediaRefDto,
	PostDetailDto,
	PostSummaryDto,
	SeriesRefDto,
	TaxonomyRefDto,
} from "@/lib/api/types";
import { formatInstantDateInTimeZone } from "@utils/content-date";
import { getPostUrlBySlug } from "@utils/url-utils";

/**
 * View model consumed by the Shirone presentation components.
 *
 * `published` / `updated` are *calendar dates* in the site time zone, encoded
 * as UTC midnight — the same convention Shirone's front matter used, so date
 * formatting, archive grouping and "last updated" arithmetic stay unchanged.
 * `publishedAt` / `updatedAt` keep the exact instants (JSON-LD, RSS, sitemap).
 */
export interface PostView {
	id: string;
	slug: string;
	url: string;
	title: string;
	description: string;
	cover: MediaRefDto | null;
	category: TaxonomyRefDto | null;
	tags: TaxonomyRefDto[];
	series: SeriesRefDto | null;
	pinned: boolean;
	published: Date;
	publishedAt: Date;
	updated: Date;
	updatedAt: Date;
	wordCount: number;
	viewCount: number;
}

export interface PostDetailView extends PostView {
	status: PostDetailDto["status"];
	contentMarkdown: string;
	seoTitle: string;
	seoDescription: string;
	previous: PostDetailDto["previous"];
	next: PostDetailDto["next"];
	seriesPosts: PostDetailDto["seriesPosts"];
}

/** Calendar date of `instant` in `timeZone`, as UTC midnight. */
export function toCalendarDate(instant: Date, timeZone: string): Date {
	return new Date(`${formatInstantDateInTimeZone(instant, timeZone)}T00:00:00Z`);
}

export function toPostView(dto: PostSummaryDto, timeZone: string): PostView {
	const publishedAt = new Date(dto.publishedAt);
	const updatedAt = new Date(dto.updatedAt);
	return {
		id: dto.id,
		slug: dto.slug,
		url: getPostUrlBySlug(dto.slug),
		title: dto.title,
		description: dto.description,
		cover: dto.cover,
		category: dto.category,
		tags: dto.tags,
		series: dto.series,
		pinned: dto.isPinned,
		published: toCalendarDate(publishedAt, timeZone),
		publishedAt,
		updated: toCalendarDate(updatedAt, timeZone),
		updatedAt,
		wordCount: dto.wordCount,
		viewCount: dto.viewCount,
	};
}

export function toPostDetailView(
	dto: PostDetailDto,
	timeZone: string,
): PostDetailView {
	return {
		...toPostView(dto, timeZone),
		status: dto.status,
		contentMarkdown: dto.contentMarkdown,
		seoTitle: dto.seoTitle,
		seoDescription: dto.seoDescription,
		previous: dto.previous,
		next: dto.next,
		seriesPosts: dto.seriesPosts,
	};
}
