import rss from "@astrojs/rss";
import { toFeedItems } from "@utils/feed";
import type { APIRoute } from "astro";

export const GET: APIRoute = async ({ locals }) => {
	const { site, api } = locals;
	const origin = new URL(site.siteConfig.site);
	const items = toFeedItems(await api.getFeed(20), origin);

	return rss({
		title: site.siteConfig.title,
		description: site.siteConfig.subtitle || site.settings.general.description || site.siteConfig.title,
		site: origin.href,
		items: items.map((item) => ({
			title: item.title,
			pubDate: item.pubDate,
			description: item.description,
			link: item.link,
			content: item.contentHtml,
			categories: [item.category, ...item.tags].filter((c): c is string => Boolean(c)),
		})),
		customData: `<language>${site.settings.general.language}</language>`,
	});
};
