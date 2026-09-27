<script lang="ts">
/**
 * M3E PullToRefresh — M3 下拉刷新原子（官方 PullToRefresh 移植）：
 * - 包裹可滚动内容；容器置于顶部并下拉超过阈值时触发 onrefresh（async 可等待）；
 * - 顶部指示器：拉动时随距离缩放/位移，松开未达阈值回弹；刷新中旋转，完成后淡出；
 * - 阻尼 0.4：手感更线性；阈值默认 80px（官方 PullToRefreshDefaults.PositionalThreshold ≈ 80dp）；
 * - 仅拦截 scrollTop = 0 且向下拉的手势，不影响正常滚动（overscroll-behavior: contain 阻止浏览器原生刷新）。
 */
let {
	refreshing = $bindable(false),
	onrefresh,
	label = "可滚动区域",
	threshold = 80,
	class: className = "",
	style = "",
	children,
}: {
	/** 刷新状态（$bindable，刷新中为 true） */
	refreshing?: boolean;
	/** 刷新回调（可返回 Promise，resolve 后结束刷新） */
	onrefresh?: () => void | Promise<void>;
	/** 触发阈值 px（默认 80） */
	threshold?: number;
	/** 可滚动区域标题（screen reader） */
	label?: string;
	class?: string;
	style?: string;
	children?: import("svelte").Snippet;
} = $props();

let containerEl: HTMLDivElement;
let pull = $state(0);
let startY = 0;
let pulling = false;

function onPointerDown(e: PointerEvent) {
	const el = containerEl;
	if (!el) return;
	if (refreshing) return;
	if (el.scrollTop <= 0) {
		pulling = true;
		startY = e.clientY;
		el.setPointerCapture(e.pointerId);
	}
}

function onPointerMove(e: PointerEvent) {
	const el = containerEl;
	if (!el || !pulling) return;
	const delta = e.clientY - startY;
	if (delta <= 0 || el.scrollTop > 0) {
		pull = 0;
		return;
	}
	pull = Math.min(delta * 0.4, 140);
}

async function onPointerUp() {
	if (!pulling) return;
	pulling = false;
	if (pull >= threshold && !refreshing) {
		refreshing = true;
		try {
			await onrefresh?.();
		} finally {
			refreshing = false;
			pull = 0;
		}
	} else {
		pull = 0;
	}
}
</script>

<div
	bind:this={containerEl}
	class="m3-pull-refresh {className}"
	class:m3-pull-refresh--refreshing={refreshing}
	role="region"
	aria-label={label}
	tabindex="0"
	{style}
	onpointerdown={onPointerDown}
	onpointermove={onPointerMove}
	onpointerup={onPointerUp}
	onpointercancel={onPointerUp}
>
	<div
		class="m3-pull-refresh__indicator"
		style="--m3-pull-progress: {pull}px; --m3-pull-active: {pull >= threshold ? 1 : 0};"
		class:m3-pull-refresh__indicator--spin={refreshing}
		aria-hidden="true"
	>
		<div class="m3-pull-refresh__spinner"></div>
	</div>
	<div class="m3-pull-refresh__content">
		{@render children?.()}
	</div>
</div>

<style lang="stylus">
.m3-pull-refresh
	position: relative
	height: 100%
	overflow-y: auto
	overscroll-behavior-y: contain
	touch-action: pan-x pan-down
	box-sizing: border-box

	.m3-pull-refresh__indicator
		position: absolute
		top: calc(var(--m3-pull-progress, 0px) - 2.5rem)
		left: 50%
		transform: translateX(-50%) scale(var(--m3-pull-active, 0))
		width: 2.5rem
		height: 2.5rem
		display: flex
		align-items: center
		justify-content: center
		border-radius: var(--shape-corner-full)
		opacity: var(--m3-pull-active, 0)
		pointer-events: none
		transition:
			opacity var(--m3e-duration-short) var(--m3e-easing-standard),
			transform var(--m3e-duration-short) var(--m3e-easing-standard)

	.m3-pull-refresh__spinner
		width: 1.5rem
		height: 1.5rem
		border-radius: var(--shape-corner-full)
		border: 2px solid unquote("color-mix(in oklab, var(--primary) 30%, transparent)")
		border-top-color: var(--primary)
		box-sizing: border-box

	&--refreshing .m3-pull-refresh__indicator
		--m3-pull-active: 1
		top: 0.75rem

	&--refreshing .m3-pull-refresh__spinner
		animation: m3-pull-spin 0.8s linear infinite

	.m3-pull-refresh__content
		min-height: 100%
		box-sizing: border-box

@keyframes m3-pull-spin
	from
		transform: rotate(0deg)
	to
		transform: rotate(360deg)
</style>