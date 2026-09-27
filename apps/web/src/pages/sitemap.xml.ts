import { escapeXml } from "@utils/feed";
import { getCategoryUrl, getPostUrlBySlug, getSeriesUrl, getTagUrl } from "@utils/url-utils";
import type { APIRoute } from "astro";
import { customPageUrl } from "@/lib/site/context";

/** Public URLs only: Draft/Private posts never appear in the sitemap payload. */
export const GET: APIRoute = async ({ locals }) => {
	const { site, api } = locals;
	const origin = site.siteConfig.site;
	const data = await api.getSitemap();
	const entries: { path: string; lastmod?: string }[] = [
		{ path: "/" },
		{ path: "/archive/" },
		{ path: "/categories/" },
		{ path: "/tags/" },
		{ path: "/series/" },
		...data.posts.map((post) => ({ path: getPostUrlBySlug(post.slug), lastmod: post.updatedAt })),
		...data.pages.map((page) => ({ path: customPageUrl(page.slug), lastmod: page.updatedAt })),
		...data.series.map((slug) => ({ path: getSeriesUrl(slug) })),
		...data.categories.map((slug) => ({ path: getCategoryUrl(slug) })),
		...data.tags.map((slug) => ({ path: getTagUrl(slug) })),
	];
	const urls = entries
		.map(({ path, lastmod }) => {
			const loc = escapeXml(new URL(path, origin).href);
			return lastmod
				? `  <url><loc>${loc}</loc><lastmod>${escapeXml(lastmod)}</lastmod></url>`
				: `  <url><loc>${loc}</loc></url>`;
		})
		.join("\n");
	const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
	return new Response(xml, {
		headers: { "Content-Type": "application/xml; charset=utf-8" },
	});
};
