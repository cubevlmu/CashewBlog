import type { SidebarConfig } from "@/types/sidebarConfig";
import { withUserConfig } from "../utils/config-overlay.ts";

/** Transitional static sidebar. Dynamic backend settings replace this in the SSR migration. */
export const sidebarConfig: SidebarConfig = withUserConfig("sidebar", {
	enable: true,
	arrangement: "dual",
	side: "left",
	components: [
		{ type: "profile", enable: true, slot: "top" },
		{ type: "announcement", enable: true, slot: "top", pages: ["home"] },
		{ type: "categories", enable: true, slot: "sticky", collapseAfter: 5 },
		{ type: "series", enable: true, slot: "sticky", collapseAfter: 5 },
		{ type: "tags", enable: true, slot: "sticky", collapseAfter: 6 },
		{ type: "stats", enable: true, slot: "top", column: "secondary", pages: ["home", "archive", "categories", "tags"] },
		{ type: "toc", enable: true, slot: "sticky", column: "secondary", pages: ["post"] },
	],
});
