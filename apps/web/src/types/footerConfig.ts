/**
 * 页脚自定义 HTML 注入配置类型。
 */
export interface FooterConfig {
	/**
	 * 是否启用自定义页脚 HTML 注入。
	 * 开启后将读取 src/config/FooterConfig.html 中的内容注入到页脚；
	 * 关闭时（false）满足零额外负担，不进行文件读取与额外 DOM 渲染。
	 */
	enable: boolean;
}
