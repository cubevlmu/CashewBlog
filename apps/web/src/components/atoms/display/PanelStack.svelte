<script lang="ts">
/**
 * M3E PanelStack — 分段堆叠面板原子（安卓 OS 设置/快捷面板风格，Surface + tonal elevation 表达）：
 * 外层容器 surface-container + corner-extra-large（官方 28dp 面板圆角）；
 * 每个直接子元素自动渲染为一个「段」：surface-container-high（高一级 tonal elevation）
 * + corner-large 圆角；段与段之间的透明间隙透出容器底色，形成安卓式分段视觉。
 * 段的内边距 / 内容完全由调用方控制（Tailwind p-* 等），原子只负责容器与分段着色。
 *
 * 用法：<PanelStack>
 *        <div class="p-4">段一内容</div>
 *        <div class="p-4">段二内容</div>
 *      </PanelStack>
 */
let {
	/** 段间透明间隙（默认 0.5rem = 8dp，安卓面板段间距） */
	gap = "0.5rem",
	/** 容器内边距（默认 0.5rem，与间隙等宽保持四周一致的透底边距） */
	padding = "0.5rem",
	class: className = "",
	children,
}: {
	gap?: string;
	padding?: string;
	class?: string;
	children?: import("svelte").Snippet;
} = $props();
</script>

<div
	class="m3-panel-stack {className}"
	style={`--m3ps-gap: ${gap}; --m3ps-padding: ${padding}`}
>
	{@render children?.()}
</div>

<style lang="stylus">
.m3-panel-stack
	display: flex
	flex-direction: column
	gap: var(--m3ps-gap, 0.5rem)
	box-sizing: border-box
	padding: var(--m3ps-padding, 0.5rem)
	border-radius: var(--shape-corner-xl) /* 官方 CornerExtraLarge 28dp 面板圆角 */
	background: var(--surface-container)
	color: var(--on-surface)

	/* 每个直接子元素 = 一个段：tonal elevation 高一级 + corner-large 圆角 */
	> :global(*)
		border-radius: var(--shape-corner-l)
		background: var(--surface-container-high)
</style>
