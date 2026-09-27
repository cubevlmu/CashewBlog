/**
 * 公告配置（AnnouncementConfig）
 * 可见性由 sidebarConfig.components 统一控制。
 */
export interface AnnouncementLinkConfig {
	/** 是否启用链接 */
	enable: boolean;
	/** 链接文本 */
	text: string;
	/** 链接 URL */
	url: string;
	/** 是否外部链接（新窗口打开） */
	external?: boolean;
}

export interface AnnouncementConfig {
	/** 公告栏标题，留空则自动使用 i18n Key.announcement ("公告") */
	title?: string;
	/** 公告正文内容 */
	content: string;
	/** 向后兼容老配置的 text 字段 */
	text?: string;
	/** 公告栏可选图标 */
	icon?: string;
	/** 公告类型 */
	type?: "info" | "warning" | "success" | "error";
	/** 是否允许用户关闭公告 */
	closable?: boolean;
	/**
	 * 关闭公告后的有效生命周期（单位：秒）。
	 * 超过此时间后，公告将重新向用户展示。
	 * 0 或未设置表示永久关闭（直到清理浏览器缓存或重置）。
	 * 例如：86400 为 24 小时，604800 为 7 天。
	 */
	closeDuration?: number;
	/** 可选行动链接配置 */
	link?: AnnouncementLinkConfig;
}
