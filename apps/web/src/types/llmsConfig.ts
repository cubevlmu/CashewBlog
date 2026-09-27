/**
 * LLMs.txt 与 AI 友好内容系统类型定义契约。
 * 规范参考：https://llmstxt.org/
 */

/**
 * 自定义链接条目（用于核心页面或扩展资源清单）
 */
export interface LlmsCustomLink {
	/** 页面或资源标题（展示在 Markdown 链接文本中） */
	title: string;
	/** 相对站内路径（如 "/about/"）或以 http(s) 开头的完整外链 */
	url: string;
	/** 简短说明或摘要（展示在链接冒号之后，帮助大模型理解该页面用途） */
	description?: string;
}

/**
 * 自定义扩展章节（展示在 /llms.txt 中作为独立 ## 章节）
 */
export interface LlmsCustomSection {
	/** 章节标题（如 "Documentation", "Open Source Projects"） */
	title: string;
	/** 章节总体说明文本（可选，展示在章节标题下方） */
	description?: string;
	/** 本章节包含的链接与条目清单 */
	items: LlmsCustomLink[];
}

/**
 * 全局 LLMs.txt 功能配置接口
 */
export interface LlmsConfig {
	/**
	 * 是否启用 /llms.txt 与 /llms-full.txt 静态端点生成。
	 * - true: 构建期生成静态文件；
	 * - false: 彻底禁用，访问返回 404，满足零额外负担。
	 */
	enable: boolean;

	/**
	 * 是否同时生成包含全量纯净正文的 /llms-full.txt。
	 * 开启后将聚合全站公开文章供 LLM 全量上下文载入。
	 */
	generateFull: boolean;

	/**
	 * 站点在大模型眼中的自我介绍短语。
	 * 省略或留空时自动回退为 siteConfig.subtitle 或 profileConfig.bio。
	 */
	siteSummary?: string;

	/**
	 * 自定义前置核心页面清单（如 Home, About, Archive 等）。
	 * 省略或为空数组时，系统将使用默认的核心导航页面。
	 */
	corePages?: LlmsCustomLink[];

	/**
	 * 自定义扩展章节列表（用于推荐外部项目或文档库，可选）。
	 */
	customSections?: LlmsCustomSection[];

	/**
	 * 敏感/私有标签黑名单（命中该标签的文章不暴露给大模型）。
	 */
	excludeTags?: string[];

	/**
	 * 敏感分类黑名单（命中该分类的文章不暴露给大模型）。
	 */
	excludeCategories?: string[];

	/**
	 * 单篇文章摘要的最大字符截断长度（默认 200 字）。
	 */
	descriptionMaxLength?: number;
}
