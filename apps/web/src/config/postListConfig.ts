import type { PostCardWidth } from "@/types/postListConfig";

/** grid 档位 → 卡片最小宽度（--post-card-min 预设，与 shape/type 分档哲学同构）。
    页面框架 90rem：regular 24rem 保证宽屏为 2 列大卡（3 列窄卡会让
    日期/分类/字数元信息行换行），compact 才给密排选项。 */
export const POST_CARD_MIN_WIDTH: Record<PostCardWidth, string> = {
	compact: "20rem",
	regular: "24rem",
	relaxed: "28rem",
};
