import { defineMiddleware } from "astro:middleware";
import { API_ORIGIN, ApiError, createBlogApi } from "@/lib/api/client";
import { loadSiteContext } from "@/lib/site/context";
import { createHash } from "node:crypto";

/** Attach the request-scoped API client and site context to every render. */
export const onRequest = defineMiddleware(async (context, next) => {
	context.locals.api = createBlogApi({
		cookie: context.request.headers.get("cookie"),
	});
	try {
		context.locals.site = await loadSiteContext();
	} catch (error) {
		if (error instanceof ApiError && error.code === "setup_required") {
			// Direct Astro development requests must enter setup through the API gateway.
			return context.redirect(import.meta.env.DEV ? `${API_ORIGIN}/setup` : "/setup", 302);
		}
		throw error;
	}
	const response = await next();
	if (!response.headers.get("content-type")?.includes("text/html")) return response;
	// Revalidate public HTML on every visit: posts may be edited, removed or made private.
	const authenticated = /(?:^|;\s*)cashewblog_auth=/.test(context.request.headers.get("cookie") ?? "");
	if (authenticated || response.status !== 200 || !context.locals.site.online
		|| response.headers.has("set-cookie") || /private|no-store/i.test(response.headers.get("cache-control") ?? "")) {
		response.headers.set("Cache-Control", "private, no-store");
		return response;
	}
	const body = await response.text();
	const etag = `"${createHash("sha256").update(body).digest("hex")}"`;
	const headers = new Headers(response.headers);
	headers.set("Cache-Control", "private, no-cache");
	// Only the device worker may reuse this HTML, after a successful server validation.
	headers.set("X-Cashew-Cache", "public-html");
	headers.set("ETag", etag);
	headers.set("Vary", [headers.get("Vary"), "Cookie"].filter(Boolean).join(", "));
	if (context.request.headers.get("if-none-match")?.split(",").map(value => value.trim()).includes(etag))
		return new Response(null, { status: 304, headers });
	return new Response(body, { status: response.status, headers });
});
