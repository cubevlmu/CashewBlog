import { type CollectionEntry, getCollection } from "astro:content";
import I18nKey from "@i18n/i18nKey";
import { i18n } from "@i18n/translation";
import {
	comparePublicationEntries,
	validatePublicationMetadata,
} from "@utils/content-date";
import {
	findUnknownSeriesSlugs,
	normaliseSeriesSlug,
	resolveSeriesPostCategory,
	type SeriesEntity,
} from "@utils/series-utils";
import { getCategoryUrl, getPostUrl } from "@utils/url-utils";

/**
 * 加载系列实体目录（Astro 内容层会缓存集合加载，多次调用成本可忽略）。
 * 放在 content-utils 而不是 series-utils，是为了让 series-utils 保持纯函数、
 * 可在 node --test 下直接导入。
 */
export async function getSeriesCatalog(): Promise<Map<string, SeriesEntity>> {
	const entries = await getCollection("series");
	const catalog = new Map<string, SeriesEntity>();
	for (const entry of entries) {
		catalog.set(entry.id, entry);
	}
	return catalog;
}

/** 已警告过的未知系列 slug：同一笔误在整次构建只提示一次 */
const warnedUnknownSeries = new Set<string>();

// // Retrieve posts and sort them by publication date
async function getRawSortedPosts(): Promise<CollectionEntry<"posts">[]> {
	const allBlogPosts = await getCollection("posts", ({ data }) => {
		return import.meta.env.PROD ? data.draft !== true : true;
	});

	for (const post of allBlogPosts) validatePublicationMetadata(post);
	const sorted = allBlogPosts.sort(comparePublicationEntries);

	// 系列默认分类（回退链）统一在这里落地：显示与聚合共用同一份「有效 category」。
	// 这里对集合条目 data 的写入是有意为之且幂等的（写入的即解析结果本身，
	// 二次解析不变），因此 permalink 的 %category%、PostMeta 与聚合计数保持一致。
	const seriesCatalog = await getSeriesCatalog();
	for (const post of sorted) {
		const seriesSlug = normaliseSeriesSlug(post.data.series);
		const seriesData = seriesSlug
			? seriesCatalog.get(seriesSlug)?.data
			: undefined;
		post.data.category = resolveSeriesPostCategory(
			post.data.category,
			seriesData,
		);
	}

	// 引用未知系列的笔误：宽容忽略，但给出一次性构建期警告（dev/build 日志可见）
	for (const ref of findUnknownSeriesSlugs(
		sorted.map((post) => ({ slug: post.id, series: post.data.series })),
		seriesCatalog,
	)) {
		if (!warnedUnknownSeries.has(ref.slug)) {
			warnedUnknownSeries.add(ref.slug);
			console.warn(
				`[series] post "${ref.postSlug}" references unknown series "${ref.slug}" — series card and default-category fallback are skipped`,
			);
		}
	}

	return sorted;
}

export async function getSortedPosts(): Promise<CollectionEntry<"posts">[]> {
	const sorted = await getRawSortedPosts();

	for (let i = 1; i < sorted.length; i++) {
		sorted[i].data.nextSlug = sorted[i - 1].id;
		sorted[i].data.nextTitle = sorted[i - 1].data.title;
		sorted[i].data.nextUrl = getPostUrl(sorted[i - 1]);
	}
	for (let i = 0; i < sorted.length - 1; i++) {
		sorted[i].data.prevSlug = sorted[i + 1].id;
		sorted[i].data.prevTitle = sorted[i + 1].data.title;
		sorted[i].data.prevUrl = getPostUrl(sorted[i + 1]);
	}

	return sorted;
}

export type PostForList = {
	slug: string;
	data: CollectionEntry<"posts">["data"];
	url?: string;
};

export async function getSortedPostsList(): Promise<PostForList[]> {
	const sortedFullPosts = await getRawSortedPosts();

	// delete post.body, attach pre-calculated URL
	const sortedPostsList: PostForList[] = sortedFullPosts.map((post) => ({
		slug: post.id,
		data: post.data,
		url: getPostUrl(post),
	}));

	return sortedPostsList;
}

export type Tag = {
	name: string;
	count: number;
};

export async function getTagList(): Promise<Tag[]> {
	const allBlogPosts = await getCollection<"posts">("posts", ({ data }) => {
		return import.meta.env.PROD ? data.draft !== true : true;
	});

	const countMap: { [key: string]: number } = {};
	allBlogPosts.forEach((post: { data: { tags: string[] } }) => {
		post.data.tags.forEach((tag: string) => {
			if (!countMap[tag]) countMap[tag] = 0;
			countMap[tag]++;
		});
	});

	// sort tags
	const keys: string[] = Object.keys(countMap).sort((a, b) => {
		return a.toLowerCase().localeCompare(b.toLowerCase());
	});

	return keys.map((key) => ({ name: key, count: countMap[key] }));
}

export type Category = {
	name: string;
	count: number;
	url: string;
};

export async function getCategoryList(): Promise<Category[]> {
	const allBlogPosts = await getCollection<"posts">("posts", ({ data }) => {
		return import.meta.env.PROD ? data.draft !== true : true;
	});
	const seriesCatalog = await getSeriesCatalog();
	const count: { [key: string]: number } = {};
	allBlogPosts.forEach(
		(post: { data: { category: string | null; series?: string } }) => {
			// 与 getRawSortedPosts 同一回退链（显式 category → 系列默认分类 → 未分类）
			const seriesSlug = normaliseSeriesSlug(post.data.series);
			const seriesData = seriesSlug
				? seriesCatalog.get(seriesSlug)?.data
				: undefined;
			const effectiveCategory = resolveSeriesPostCategory(
				post.data.category,
				seriesData,
			);
			if (!effectiveCategory) {
				const ucKey = i18n(I18nKey.uncategorized);
				count[ucKey] = count[ucKey] ? count[ucKey] + 1 : 1;
				return;
			}

			const categoryName = effectiveCategory.trim();

			count[categoryName] = count[categoryName] ? count[categoryName] + 1 : 1;
		},
	);

	const lst = Object.keys(count).sort((a, b) => {
		return a.toLowerCase().localeCompare(b.toLowerCase());
	});

	const ret: Category[] = [];
	for (const c of lst) {
		ret.push({
			name: c,
			count: count[c],
			url: getCategoryUrl(c),
		});
	}
	return ret;
}
