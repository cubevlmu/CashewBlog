/**
 * 文章列表配置类型。值与默认配置见 src/config/postListConfig.ts。
 */

/** 列表布局模式：list 单列（封面左/右）/ grid 自适应网格（封面置顶贴边） */
export type PostListMode = "list" | "grid";

/** list 模式下封面所在侧（grid 模式封面固定置顶，不受此项影响） */
export type PostListCoverSide = "left" | "right";

/** grid 模式卡片最小宽度档位（映射 --post-card-min，不暴露裸像素） */
export type PostCardWidth = "compact" | "regular" | "relaxed";

export interface PostListLayoutConfig {
	mode: PostListMode;
	cover: PostListCoverSide;
	cardWidth: PostCardWidth;
}

export interface PostListConfig {
	/** 首页每页文章数 */
	pageSize: number;
	layout: PostListLayoutConfig;
}
