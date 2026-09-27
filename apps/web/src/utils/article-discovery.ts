import { comparePublicationEntries } from "@utils/content-date";

export interface DiscoverableArticle {
	slug: string;
	data: {
		title: string;
		published: Date;
		publishedAt?: Date;
		description?: string;
		tags: string[];
		category: string | null;
	};
}

export interface ArticleDiscoveryResult<T extends DiscoverableArticle> {
	related: T[];
	random: T[];
}

function normalizeText(value: string | null | undefined): string {
	return value?.trim().toLocaleLowerCase() ?? "";
}

function normalizeCount(value: number): number {
	return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
}

function uniqueArticles<T extends DiscoverableArticle>(articles: T[]): T[] {
	const seen = new Set<string>();
	return articles.filter((article) => {
		if (seen.has(article.slug)) return false;
		seen.add(article.slug);
		return true;
	});
}

function normalizedTags(article: DiscoverableArticle): Set<string> {
	return new Set(article.data.tags.map(normalizeText).filter(Boolean));
}

function comparePublishedThenSlug(
	a: DiscoverableArticle,
	b: DiscoverableArticle,
): number {
	return comparePublicationEntries(
		{ id: a.slug, data: a.data },
		{ id: b.slug, data: b.data },
	);
}

function stableHash(value: string): number {
	let hash = 0x811c9dc5;
	for (let index = 0; index < value.length; index++) {
		hash ^= value.charCodeAt(index);
		hash = Math.imul(hash, 0x01000193);
	}
	return hash >>> 0;
}

export function selectRelatedArticles<T extends DiscoverableArticle>(
	current: T,
	articles: T[],
	count: number,
): T[] {
	const limit = normalizeCount(count);
	if (limit === 0) return [];

	const candidates = uniqueArticles(articles).filter(
		(article) => article.slug !== current.slug,
	);
	const currentTags = normalizedTags(current);
	const currentCategory = normalizeText(current.data.category);
	const tagFrequency = new Map<string, number>();

	for (const article of uniqueArticles([current, ...candidates])) {
		for (const tag of normalizedTags(article)) {
			tagFrequency.set(tag, (tagFrequency.get(tag) ?? 0) + 1);
		}
	}

	const corpusSize = candidates.length + 1;
	return candidates
		.map((article) => {
			let score = 0;
			for (const tag of normalizedTags(article)) {
				if (!currentTags.has(tag)) continue;
				const frequency = tagFrequency.get(tag) ?? corpusSize;
				score += 2 + Math.log2((corpusSize + 1) / frequency);
			}

			const category = normalizeText(article.data.category);
			if (currentCategory && category === currentCategory) score += 1;

			return { article, score };
		})
		.filter(({ score }) => score > 0)
		.sort(
			(a, b) =>
				b.score - a.score || comparePublishedThenSlug(a.article, b.article),
		)
		.slice(0, limit)
		.map(({ article }) => article);
}

export function selectRandomArticles<T extends DiscoverableArticle>(
	current: T,
	articles: T[],
	count: number,
	excludedSlugs: Iterable<string> = [],
): T[] {
	const limit = normalizeCount(count);
	if (limit === 0) return [];

	const excluded = new Set(excludedSlugs);
	excluded.add(current.slug);

	return uniqueArticles(articles)
		.filter((article) => !excluded.has(article.slug))
		.map((article) => ({
			article,
			rank: stableHash(`${current.slug}\u0000${article.slug}`),
		}))
		.sort(
			(a, b) => a.rank - b.rank || a.article.slug.localeCompare(b.article.slug),
		)
		.slice(0, limit)
		.map(({ article }) => article);
}

export function discoverArticles<T extends DiscoverableArticle>(
	current: T,
	articles: T[],
	relatedCount: number,
	randomCount: number,
): ArticleDiscoveryResult<T> {
	const related = selectRelatedArticles(current, articles, relatedCount);
	const random = selectRandomArticles(
		current,
		articles,
		randomCount,
		related.map((article) => article.slug),
	);
	return { related, random };
}
