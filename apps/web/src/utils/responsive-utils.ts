import { sidebarConfig } from "@/config/sidebarConfig";
import { PAGE_WIDTH, PAGE_WIDTH_DUAL } from "../constants/constants";

export interface ResponsiveSidebarConfig {
	arrangement: "single" | "dual";
	side: "left" | "right";
	hasPrimary: boolean;
	hasSecondary: boolean;
}

/**
 * 解析侧栏配置：按 column 标签统计两栏各自的 enable widget。
 * 响应式断点沿用站点现有约定：
 * - 1024px 以下：单列（grid-cols-1），侧栏与内容上下堆叠；
 * - 1024px 以上：两列（侧栏 --sidebar-width + 内容）；
 * - dual 编排且副栏有 widget 时，1280px（xl）起升为三列。
 */
export function getResponsiveSidebarConfig(): ResponsiveSidebarConfig {
	const widgets = sidebarConfig.enable
		? sidebarConfig.components.filter((widget) => widget.enable)
		: [];
	const inColumn = (column: "primary" | "secondary") =>
		widgets.filter((widget) => (widget.column ?? "primary") === column);
	return {
		arrangement: sidebarConfig.arrangement,
		side: sidebarConfig.side,
		hasPrimary: widgets.length > 0,
		hasSecondary: inColumn("secondary").length > 0,
	};
}

/** dual 编排是否实际生效（副栏有 widget 才升级三列/加宽页框） */
export function isDualColumn(config: ResponsiveSidebarConfig): boolean {
	return config.arrangement === "dual" && config.hasSecondary;
}

/**
 * 生成主网格列类。
 * single：侧栏列 + 内容列（side 决定先后），1024px 以下单列；
 * dual：xl 起三列（副栏 + 内容 + 主栏，side 决定主栏物理侧），
 * lg→xl 之间与 single 同构（副栏隐藏，主栏照常）。
 * 侧栏宽度走 --sidebar-width（variables.styl 单源），类名保持静态字面量
 * （Tailwind 扫描器不解析模板字符串拼接的类名）。
 */
export function generateGridClasses(config: ResponsiveSidebarConfig): string {
	const hasSidebar = config.hasPrimary;
	if (!hasSidebar) {
		return "grid-cols-1";
	}
	if (isDualColumn(config)) {
		return config.side === "left"
			? "grid-cols-1 lg:grid-cols-[var(--sidebar-width)_1fr] xl:grid-cols-[var(--sidebar-width)_1fr_var(--sidebar-width)]"
			: "grid-cols-1 lg:grid-cols-[1fr_var(--sidebar-width)] xl:grid-cols-[var(--sidebar-width)_1fr_var(--sidebar-width)]";
	}
	return config.side === "left"
		? "grid-cols-1 lg:grid-cols-[var(--sidebar-width)_1fr]"
		: "grid-cols-1 lg:grid-cols-[1fr_var(--sidebar-width)]";
}

/**
 * 主栏容器类：1024px 以下侧栏位于内容之后（第二行，还原 Fuwari 原版顺序），
 * 1024px 以上定位到对应列；dual 时主栏恒在 side 一侧（xl 不变）。
 */
export function generatePrimarySidebarClasses(
	config: ResponsiveSidebarConfig,
): string {
	const base = [
		"mb-4",
		"row-start-2",
		"row-end-3",
		"col-span-2",
		"lg:row-start-1",
		"lg:row-end-2",
		"lg:col-span-1",
		"lg:max-w-[var(--sidebar-width)]",
		"onload-animation",
	];
	if (config.side === "left") {
		base.push("lg:col-start-1");
	} else if (isDualColumn(config)) {
		base.push("lg:col-start-2", "xl:col-start-3");
	} else {
		base.push("lg:col-start-2");
	}
	return base.join(" ");
}

/**
 * 副栏容器类：1280px（xl）以下整列隐藏（dual 自动退化为单栏），
 * xl 起定位到主栏对面列，与主栏同宽。
 */
export function generateSecondarySidebarClasses(
	config: ResponsiveSidebarConfig,
): string {
	const base = [
		"hidden",
		"xl:block",
		"xl:row-start-1",
		"xl:row-end-2",
		"xl:col-span-1",
		"xl:max-w-[var(--sidebar-width)]",
		"onload-animation",
	];
	base.push(config.side === "left" ? "xl:col-start-3" : "xl:col-start-1");
	return base.join(" ");
}

/**
 * 主内容区类：1024px 以下全宽（第一行，内容在前），1024px 以上定位到内容列。
 * dual 时内容恒居中列（xl:col-start-2）；single 时按 side 让位。
 */
export function generateMainContentClasses(
	config: ResponsiveSidebarConfig,
): string {
	const base = [
		"transition-swup-fade",
		"col-span-2",
		"lg:col-span-1",
		"overflow-hidden",
		"min-w-0",
	];
	if (isDualColumn(config)) {
		base.push("lg:col-start-2", "xl:col-start-2");
	} else if (config.side === "left") {
		base.push("lg:col-start-2");
	} else {
		base.push("lg:col-start-1");
	}
	return base.join(" ");
}

/**
 * 页框宽度按侧栏编排自动解析：dual 升为三列时加宽一档（96rem），
 * 其余维持 85rem。Layout.astro 注入为全局 --page-width。
 */
export function resolvePageWidth(): string {
	const config = getResponsiveSidebarConfig();
	return isDualColumn(config) ? `${PAGE_WIDTH_DUAL}rem` : `${PAGE_WIDTH}rem`;
}
