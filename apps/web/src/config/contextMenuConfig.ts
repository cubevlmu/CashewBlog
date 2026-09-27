import type { ContextMenuConfig } from "@/types/contextMenuConfig";

/** Optional desktop context-menu enhancement. */
export const contextMenuConfig: ContextMenuConfig = {
		enable: true,
		actions: ["copySelection", "backToTop", "sharePageLink"],
};
