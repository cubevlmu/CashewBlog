<script lang="ts">
/**
 * M3E 通用原子 — Avatar 头像。
 * 图片加载失败或未提供时回退为文字（首字母 / 自定义 fallback）。
 */
let {
	src = "",
	srcset,
	sizes,
	width,
	height,
	loading = "lazy",
	fetchPriority,
	alt = "",
	/** 直径（px），默认 40 */
	size = 40,
	/** 形状：circle 圆形（默认）/ rounded 圆角方形 / square 方形 */
	shape = "circle",
	/** 无图 / 加载失败时的回退文字（默认取 alt 首字符） */
	fallback = "",
	class: className = "",
}: {
	src?: string;
	srcset?: string;
	sizes?: string;
	width?: number;
	height?: number;
	loading?: "lazy" | "eager";
	fetchPriority?: "high" | "low" | "auto";
	alt?: string;
	size?: number;
	shape?: "circle" | "rounded" | "square";
	fallback?: string;
	class?: string;
} = $props();

let failed = $state(false);
const style = `--m3e-avatar-size: ${size}px`;
const initial = fallback || (alt.trim() ? alt.trim()[0] : "?");
</script>

<div
	class="m3-avatar m3-avatar--{shape} {className}"
	{style}
	role={alt ? "img" : undefined}
	aria-label={alt || undefined}
>
	{#if src && !failed}
		<img
			src={src}
			{srcset}
			{sizes}
			{width}
			{height}
			alt={alt}
			{loading}
			fetchpriority={fetchPriority}
			decoding="async"
			onerror={() => (failed = true)}
		/>
	{:else}
		<span class="m3-avatar__fallback">{initial}</span>
	{/if}
</div>

<style lang="stylus">
.m3-avatar
	display: flex
	align-items: center
	justify-content: center
	flex-shrink: 0
	width: var(--m3e-avatar-size)
	/* 保持 1:1 正方形：宽度可被调用方覆盖（如 !w-full），高度随宽自适应 */
	aspect-ratio: 1
	height: auto
	overflow: hidden
	background: var(--surface-container-high)
	color: var(--on-surface-variant)
	user-select: none

	&--circle
		border-radius: var(--shape-corner-full)
	&--rounded
		border-radius: var(--shape-corner-m)
	&--square
		border-radius: 0

	> img
		display: block
		width: 100%
		height: 100%
		object-fit: cover

	&__fallback
		font: var(--m3e-type-title-medium)
		font-weight: 700
</style>
