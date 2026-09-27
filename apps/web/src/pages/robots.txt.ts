import type { APIRoute } from "astro";

export const GET: APIRoute = ({ locals }) => {
	const { settings, siteConfig } = locals.site;
	const lines = [
		"User-agent: *",
		"Disallow: /_astro/",
		"Disallow: /admin/",
		"Disallow: /api/",
		"Disallow: /setup",
		settings.seo.extraRobots.trim(),
		"",
		`Sitemap: ${new URL("/sitemap.xml", siteConfig.site).href}`,
	].filter((line, index, all) => line !== "" || all[index - 1] !== "");
	return new Response(`${lines.join("\n").trim()}\n`, {
		headers: { "Content-Type": "text/plain; charset=utf-8" },
	});
};
