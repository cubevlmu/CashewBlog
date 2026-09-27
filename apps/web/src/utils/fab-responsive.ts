import type { FabDeviceTarget } from "@/types/fabConfig";

/**
 * 将配置声明的目标设备数组转换为确定性的 Tailwind CSS 显隐类名。
 * 纯函数，在 Astro SSR 渲染阶段直接计算注入，消除任何首屏 JS 延迟与样式闪烁。
 */
export function resolveDeviceClasses(devices?: FabDeviceTarget[]): string {
	if (!devices || devices.length === 0 || devices.length === 3) {
		return "flex";
	}

	const hasMobile = devices.includes("mobile");
	const hasTablet = devices.includes("tablet");
	const hasDesktop = devices.includes("desktop");

	if (hasMobile && hasTablet && !hasDesktop) {
		return "flex lg:hidden";
	}
	if (!hasMobile && hasTablet && hasDesktop) {
		return "hidden md:flex";
	}
	if (hasMobile && !hasTablet && hasDesktop) {
		return "flex md:hidden lg:flex";
	}
	if (hasMobile && !hasTablet && !hasDesktop) {
		return "flex md:hidden";
	}
	if (!hasMobile && hasTablet && !hasDesktop) {
		return "hidden md:flex lg:hidden";
	}
	if (!hasMobile && !hasTablet && hasDesktop) {
		return "hidden lg:flex";
	}

	return "flex";
}
