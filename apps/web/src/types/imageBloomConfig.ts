/**
 * Tonal Bloom（色调辉光占位）配置类型定义。
 * 在图片加载就绪前锁定容器几何尺寸并呈现色彩氛围，避免首屏布局偏移并支持平滑渐显。
 */
export interface ImageBloomConfig {
	/** 是否开启 Tonal Bloom 占位（设为 false 时零额外 DOM、零额外网络请求） */
	enable: boolean;
	/** 辉光模糊半径（单位 px，默认 20） */
	blurRadius?: number;
	/** 辉光图层不透明度（默认 0.7） */
	opacity?: number;
	/** 图片就绪后的淡入淡出过渡时长（单位 ms，默认 300） */
	transitionDuration?: number;
}
