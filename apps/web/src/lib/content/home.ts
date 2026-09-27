import { type PostView, toPostView } from "./posts";

export interface HomeFeed {
	posts: PostView[];
	currentPage: number;
	totalPages: number;
}

/** One page of the homepage feed (pinned first, then newest), or null past the end. */
export async function loadHomeFeed(
	locals: App.Locals,
	page: number,
): Promise<HomeFeed | null> {
	const { site, api } = locals;
	const result = await api.getPosts({ page, pageSize: site.postListConfig.pageSize });
	if (page > 1 && page > result.totalPages) return null;
	return {
		posts: result.items.map((dto) => toPostView(dto, site.siteConfig.timeZone)),
		currentPage: result.page,
		totalPages: Math.max(1, result.totalPages),
	};
}
