<script lang="ts">
/**
 * M3E Carousel — M3 轮播原子（官方 Carousel / HorizontalUncontainedCarousel 移植，scroll-snap 实现）：
 * - 横向滚动 + scroll-snap（mandatory 默认 / proximity / none），滚动后自动吸附；
 * - itemWidth 控制卡片宽度：<100% 时露出相邻卡片（官方 uncontained 露出下一张的视觉）；
 * - itemSpacing 卡片间距，contentPadding 容器左右内边距；
 * - 滚动中通过 IntersectionObserver 计算当前焦点项，触发 onchange(index)；
 * - 通用场景：图片画廊、横向卡片列表、多横幅展示。
 */
let {
	items = [],
	itemWidth = "70%",
	itemSpacing = "1rem",
	contentPadding = "1rem",
	snap = "mandatory",
	label = "轮播",
	onchange,
	class: className = "",
	style = "",
	children,
}: {
	/** 数据项数组（通过 children snippet 渲染每一项） */
	items?: unknown[];
	/** 每项宽度（CSS，如 "70%" / "300px"；<100% 露出相邻卡片） */
	itemWidth?: string;
	/** 项间距 */
	itemSpacing?: string;
	/** 容器左右内边距 */
	contentPadding?: string;
	/** 吸附方式：mandatory（默认）/ proximity / none */
	snap?: "mandatory" | "proximity" | "none";
	label?: string;
	/** 焦点项变化回调 */
	onchange?: (index: number) => void;
	class?: string;
	style?: string;
	children?: import("svelte").Snippet<[unknown, number]>;
} = $props();

let containerEl: HTMLDivElement;
let activeIndex = $state(0);

function updateActive() {
	const el = containerEl;
	if (!el) return;
	const nodes = [...el.querySelectorAll<HTMLElement>("[data-carousel-item]")];
	if (!nodes.length) return;
	let best = 0;
	let bestDist = Number.POSITIVE_INFINITY;
	const center = el.scrollLeft + el.clientWidth / 2;
	for (let i = 0; i < nodes.length; i++) {
		const nodeCenter = nodes[i].offsetLeft + nodes[i].offsetWidth / 2;
		const dist = Math.abs(nodeCenter - center);
		if (dist < bestDist) {
			bestDist = dist;
			best = i;
		}
	}
	if (best !== activeIndex) {
		activeIndex = best;
		onchange?.(best);
	}
}

/** 键盘：方向键 / Home / End 滚动轮播（官方 Carousel 键盘行为） */
function onScrollerKeydown(e: KeyboardEvent) {
	const el = containerEl;
	if (!el) return;
	if (
		e.key === "ArrowRight" ||
		e.key === "ArrowLeft" ||
		e.key === "Home" ||
		e.key === "End"
	) {
		e.preventDefault();
		if (e.key === "Home") {
			el.scrollTo({ left: 0, behavior: "smooth" });
			return;
		}
		if (e.key === "End") {
			el.scrollTo({ left: el.scrollWidth, behavior: "smooth" });
			return;
		}
		const items = [...el.querySelectorAll<HTMLElement>("[data-carousel-item]")];
		if (!items.length) return;
		const gap = Number.parseFloat(getComputedStyle(el).columnGap || "0");
		const step = items[0].offsetWidth + gap;
		const current = Math.round(el.scrollLeft / step);
		const target = Math.max(
			0,
			Math.min(items.length - 1, current + (e.key === "ArrowRight" ? 1 : -1)),
		);
		el.scrollTo({ left: target * step, behavior: "smooth" });
	}
}
</script>

<div
	class="m3-carousel {className}"
	class:m3-carousel--proximity={snap === "proximity"}
	class:m3-carousel--none={snap === "none"}
	{style}
>
	<div
		bind:this={containerEl}
		class="m3-carousel__scroller"
		style="--m3-carousel-padding: {contentPadding}; --m3-carousel-gap: {itemSpacing};"
		role="region"
		aria-label={label}
		tabindex="0"
		onscroll={updateActive}
		onkeydown={onScrollerKeydown}
	>
		{#each items as item, i (i)}
			<div
				class="m3-carousel__item"
				data-carousel-item
				style="width: {itemWidth};"
			>
				{@render children?.(item, i)}
			</div>
		{/each}
	</div>
</div>

<style lang="stylus">
.m3-carousel
	width: 100%
	box-sizing: border-box

	.m3-carousel__scroller
		display: flex
		align-items: stretch
		gap: var(--m3-carousel-gap, 1rem)
		padding-inline: var(--m3-carousel-padding, 1rem)
		overflow-x: auto
		scroll-snap-type: x mandatory
		scrollbar-width: none
		-webkit-overflow-scrolling: touch

		&::-webkit-scrollbar
			display: none

	.m3-carousel__item
		flex: 0 0 auto
		scroll-snap-align: center
		box-sizing: border-box

	&--proximity .m3-carousel__scroller
		scroll-snap-type: unquote("x proximity")

	&--none .m3-carousel__scroller
		scroll-snap-type: unquote("x none")
</style>