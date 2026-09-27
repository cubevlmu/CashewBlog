/**
 * M3E Snackbar 事件总线。
 * Snackbar.svelte 监听该事件；任何环境（含纯 JS 的 markdown 复制按钮）
 * 通过 showSnackbar() 触发，无需组件间直接耦合。
 *
 * 可选增强：action（操作按钮，label-large + inverse-primary，点击执行并关闭）、
 * icon（24dp 图标，inverse-on-surface）。
 * 旧签名 showSnackbar(message: string) 完全兼容。
 */
export const SNACKBAR_EVENT = "m3e:snackbar";

export interface SnackbarAction {
	label: string;
	onClick: () => void;
}

export interface SnackbarOptions {
	action?: SnackbarAction;
	icon?: string;
}

export interface SnackbarDetail {
	message: string;
	action?: SnackbarAction;
	icon?: string;
}

export function showSnackbar(message: string, options?: SnackbarOptions): void {
	if (typeof window === "undefined") return;
	const detail: SnackbarDetail = { message };
	if (options?.action) detail.action = options.action;
	if (options?.icon) detail.icon = options.icon;
	window.dispatchEvent(new CustomEvent(SNACKBAR_EVENT, { detail }));
}
