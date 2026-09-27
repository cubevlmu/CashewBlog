import type { AnimeStatus } from "../../data/anime.ts";
import I18nKey from "../../i18n/i18nKey.ts";

/** 状态呈现元数据：筛选 chip 的 i18n 键 / 前置图标 / M3E 语义色（tonal pill 用） */
export const ANIME_STATUS_META: Record<
	AnimeStatus,
	{ key: I18nKey; icon: string; color: string }
> = {
	watching: {
		key: I18nKey.animeStatusWatching,
		icon: "material-symbols:play-arrow-rounded",
		color: "var(--primary)",
	},
	completed: {
		key: I18nKey.animeStatusCompleted,
		icon: "material-symbols:check-rounded",
		color: "var(--tertiary)",
	},
	planned: {
		key: I18nKey.animeStatusPlanned,
		icon: "material-symbols:bookmark-outline-rounded",
		color: "var(--secondary)",
	},
	onHold: {
		key: I18nKey.animeStatusOnHold,
		icon: "material-symbols:pause-rounded",
		color: "var(--on-surface-variant)",
	},
	dropped: {
		key: I18nKey.animeStatusDropped,
		icon: "material-symbols:close-rounded",
		color: "var(--error)",
	},
};
