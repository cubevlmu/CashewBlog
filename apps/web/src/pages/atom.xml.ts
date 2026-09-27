import { buildAtomXml, getFeedPosts } from "@utils/feed";
import type { APIContext } from "astro";
import { profileConfig, siteConfig } from "@/config";

export async function GET(context: APIContext): Promise<Response> {
	const site = context.site ?? new URL(siteConfig.site);
	const posts = await getFeedPosts(site);

	const xml = buildAtomXml({
		title: siteConfig.title,
		subtitle: siteConfig.subtitle || "No description",
		lang: siteConfig.lang,
		author: profileConfig.name,
		siteUrl: site.href,
		feedUrl: new URL("atom.xml", site).href,
		items: posts,
	});

	return new Response(xml, {
		headers: {
			"Content-Type": "application/atom+xml; charset=utf-8",
		},
	});
}
