import { defineMiddleware } from "astro:middleware";
import { createBlogApi } from "@/lib/api/client";
import { loadSiteContext } from "@/lib/site/context";

/** Attach the request-scoped API client and site context to every render. */
export const onRequest = defineMiddleware(async (context, next) => {
	context.locals.api = createBlogApi({
		cookie: context.request.headers.get("cookie"),
	});
	context.locals.site = await loadSiteContext();
	return next();
});
