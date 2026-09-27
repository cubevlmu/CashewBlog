/**
 * Permalink 固定链接配置类型定义
 */
export interface PermalinkConfig {
	/** 是否启用全局文章固定链接功能，关闭时使用默认的文件名作为链接 (/posts/<slug>/) */
	enable: boolean;
	/**
	 * 固定链接格式模板
	 * 支持的占位符：
	 * - %year% : 4 位年份 (如 2024)
	 * - %monthnum% : 2 位月份 (01-12)
	 * - %day% : 2 位日期 (01-31)
	 * - %hour% : 2 位小时 (00-23)
	 * - %minute% : 2 位分钟 (00-59)
	 * - %second% : 2 位秒数 (00-59)
	 * - %post_id% : 文章序号（按发布时间升序排列，最早的文章为 1）
	 * - %postname% : 文章文件名（slug，通常为全小写）
	 * - %raw_postname% : 文章原始文件名（保留大小写）
	 * - %category% : 分类名（无分类时为 "uncategorized"）
	 *
	 * 示例：
	 * - "%year%-%monthnum%-%postname%" => "/2024-12-my-post/"
	 * - "%post_id%-%postname%" => "/42-my-post/"
	 * - "%category%-%postname%" => "/tech-my-post/"
	 * - "%year%/%monthnum%/%day%/%postname%" => "/2024/12/01/my-post/"
	 *
	 * 注意：支持使用斜杠 "/" 构建嵌套路径。
	 */
	format: string;
}
