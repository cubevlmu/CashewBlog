import type {
	CategorySummaryDto,
	CustomPageDto,
	FeedPostDto,
	PagedDto,
	PostDetailDto,
	PostSummaryDto,
	SearchResponseDto,
	SeriesDetailDto,
	SeriesSummaryDto,
	SiteBootstrapDto,
	SitemapDto,
	TagSummaryDto,
} from "./types";

/** Base URL of the ASP.NET API as seen from the SSR server (loopback in the image). */
export const API_ORIGIN = (
	process.env.CASHEWBLOG_API_URL ?? "http://127.0.0.1:8080"
).replace(/\/+$/, "");

export class ApiError extends Error {
	readonly status: number;
	readonly path: string;
	readonly code?: string;
	constructor(
		status: number,
		path: string,
		code?: string,
	) {
		super(`CashewBlog API ${path} responded ${status}`);
		this.name = "ApiError";
		this.status = status;
		this.path = path;
		this.code = code;
	}
}

async function apiError(response: Response, path: string): Promise<ApiError> {
	const problem = await response.json().catch(() => null);
	return new ApiError(response.status, path, typeof problem?.error === "string" ? problem.error : undefined);
}

export interface PostListQuery {
	page?: number;
	pageSize?: number;
	category?: string;
	tag?: string;
	series?: string;
}

function query(params: Record<string, string | number | undefined>): string {
	const search = new URLSearchParams();
	for (const [key, value] of Object.entries(params)) {
		if (value !== undefined && value !== "") search.set(key, String(value));
	}
	const text = search.toString();
	return text ? `?${text}` : "";
}

const segment = (value: string) =>
	value.split("/").map(encodeURIComponent).join("/");

/**
 * Request-scoped API client. `cookie` is the visitor's Cookie header; it is
 * forwarded only on reads that may reveal admin-only content (Private posts),
 * so anonymous and authenticated responses never share a cache entry.
 */
export function createBlogApi(options: { cookie?: string | null } = {}) {
	async function request<T>(
		path: string,
		init: { withCookie?: boolean; allowNotFound: true },
	): Promise<T | null>;
	async function request<T>(
		path: string,
		init?: { withCookie?: boolean; allowNotFound?: false },
	): Promise<T>;
	async function request<T>(
		path: string,
		init: { withCookie?: boolean; allowNotFound?: boolean } = {},
	): Promise<T | null> {
		const headers: Record<string, string> = { accept: "application/json" };
		if (init.withCookie && options.cookie) headers.cookie = options.cookie;
		const response = await fetch(`${API_ORIGIN}/api${path}`, { headers });
		if (response.status === 404 && init.allowNotFound) return null;
		if (!response.ok) throw await apiError(response, path);
		return (await response.json()) as T;
	}

	return {
		getPosts: (q: PostListQuery = {}) =>
			request<PagedDto<PostSummaryDto>>(`/posts${query({ ...q })}`),
		getPost: (slug: string) =>
			request<PostDetailDto>(`/posts/${segment(slug)}`, {
				withCookie: true,
				allowNotFound: true,
			}),
		getArchive: () => request<PostSummaryDto[]>("/archive"),
		getFeed: (limit = 20) => request<FeedPostDto[]>(`/feed${query({ limit })}`),
		getCategories: () => request<CategorySummaryDto[]>("/categories"),
		getTags: () => request<TagSummaryDto[]>("/tags"),
		getSeries: () => request<SeriesSummaryDto[]>("/series"),
		getSeriesBySlug: (slug: string) =>
			request<SeriesDetailDto>(`/series/${segment(slug)}`, {
				allowNotFound: true,
			}),
		search: (q: string, page = 1) =>
			request<SearchResponseDto>(`/search${query({ q, page })}`),
		getCustomPage: (slug: string) =>
			request<CustomPageDto>(`/pages/${segment(slug)}`, { allowNotFound: true }),
		getSitemap: () => request<SitemapDto>("/sitemap"),
	};
}

export type BlogApi = ReturnType<typeof createBlogApi>;

/**
 * Bootstrap is identical for every visitor, so it is cached process-wide and
 * revalidated with its ETag at most once per `BOOTSTRAP_TTL_MS`.
 */
const BOOTSTRAP_TTL_MS = 5_000;
let bootstrapCache:
	| { data: SiteBootstrapDto; etag: string | null; checkedAt: number }
	| undefined;
let inflight: Promise<SiteBootstrapDto> | undefined;

export async function getBootstrap(): Promise<SiteBootstrapDto> {
	if (bootstrapCache && Date.now() - bootstrapCache.checkedAt < BOOTSTRAP_TTL_MS) {
		return bootstrapCache.data;
	}
	inflight ??= (async () => {
		try {
			const headers: Record<string, string> = { accept: "application/json" };
			if (bootstrapCache?.etag) headers["if-none-match"] = bootstrapCache.etag;
			const response = await fetch(`${API_ORIGIN}/api/site/bootstrap`, { headers });
			if (response.status === 304 && bootstrapCache) {
				bootstrapCache.checkedAt = Date.now();
				return bootstrapCache.data;
			}
			if (!response.ok) throw await apiError(response, "/site/bootstrap");
			const data = (await response.json()) as SiteBootstrapDto;
			bootstrapCache = {
				data,
				etag: response.headers.get("etag"),
				checkedAt: Date.now(),
			};
			return data;
		} finally {
			inflight = undefined;
		}
	})();
	return inflight;
}
