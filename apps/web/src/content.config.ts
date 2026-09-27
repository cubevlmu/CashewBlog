import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro/zod";

const postsCollection = defineCollection({
	loader: glob({ base: "./src/content/posts", pattern: "**/*.{md,mdx}" }),
	schema: z.object({
		title: z.string(),
		published: z.date(),
		publishedAt: z.date().optional(),
		updated: z.date().optional(),
		updatedAt: z.date().optional(),
		pinned: z.boolean().optional().default(false),
		draft: z.boolean().optional().default(false),
		description: z.string().optional().default(""),
		image: z.string().optional().default(""),
		tags: z.array(z.string()).optional().default([]),
		category: z.string().optional().nullable().default(""),
		/** 所属系列 slug（空 = 不属于任何系列；单归属；落库前统一 trim） */
		series: z
			.string()
			.optional()
			.default("")
			.transform((value) => value.trim()),
		/** 系列内顺序；缺省回退为按发布日期排 */
		seriesOrder: z.number().int().optional(),

		/* Post alias & custom permalink (removed in dynamic migration) */

		/* For internal use */
		prevUrl: z.string().optional(),
		nextUrl: z.string().optional(),
		prevTitle: z.string().default(""),
		prevSlug: z.string().default(""),
		nextTitle: z.string().default(""),
		nextSlug: z.string().default(""),
	}),
});

const specCollection = defineCollection({
	loader: glob({ base: "./src/content/spec", pattern: "**/*.{md,mdx}" }),
	schema: z.object({}),
});

/**
 * 系列实体集合：每篇 = 一个系列。body 是可选总览，未写则系列页仅列文章。
 * defaultCategory 是回退值（显式 category 优先），解析见 utils/series-utils.ts。
 */
const seriesCollection = defineCollection({
	loader: glob({ base: "./src/content/series", pattern: "**/*.md" }),
	schema: z.object({
		title: z.string(),
		status: z.enum(["ongoing", "completed"]).optional().default("ongoing"),
		defaultCategory: z.string().optional().default(""),
	}),
});


export const collections = {
	posts: postsCollection,
	spec: specCollection,
	series: seriesCollection,
} as const;
