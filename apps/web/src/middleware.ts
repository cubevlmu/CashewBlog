import { defineMiddleware } from "astro:middleware";
import { API_ORIGIN, ApiError, createBlogApi } from "@/lib/api/client";
import { loadSiteContext } from "@/lib/site/context";

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
	return next();
});
