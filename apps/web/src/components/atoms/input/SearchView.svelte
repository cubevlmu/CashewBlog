<script lang="ts">
import Icon from "@iconify/svelte";
import type { TransitionConfig } from "svelte/transition";
import { fade } from "svelte/transition";

/**
 * M3E SearchView — M3 搜索视图（官方 SearchBar.kt 的 SearchView / SearchViewTokens 移植，token 对齐 v0.192 md-comp-search-view）：
 * - 两种形态：docked（内嵌卡片，corner-extra-large 28px + elevation level3 + 56px 头）/ fullScreen（全屏覆盖层，无圆角 + 72px 头）；
 * - 头部：leading 返回箭头（on-surface）+ 输入框（body-large on-surface）+ trailing 清除/辅助图标（on-surface-variant）；
 * - 内容区：history（空查询时显示历史搜索）/ suggestions（输入时过滤建议，可选 leading 图标）/ 默认插槽放自定义结果；
 * - 分隔线 outline；容器 surface-container-high；Esc / 返回箭头触发 onclose。
 *
 * 动画（对齐官方 SearchBar.kt 的 SearchBarState / DockedEnterTransition）：
 * - open 切换：docked 用 fade + expandVertically（进入 600ms + 100ms 延迟 emphasized-decelerate 0.05,0.7,0.1,1）
 *   / fade + shrinkVertically（退出 350ms + 100ms 延迟 cubic-bezier(0,1,0,1)）；fullScreen 仅 fade（覆盖层容器变换简化为淡入淡出）；
 * - 内容区/区块出现：淡入 100ms + 50ms 延迟 standard-accelerate 0.3,0,1,1，淡出 100ms standard-decelerate 0,0,0,1。
 */
let {
	open = $bindable(false),
	query = $bindable(""),
	label = "搜索",
	placeholder = "搜索",
	history = [],
	suggestions = [],
	fullScreen = true,
	onselect,
	onclose,
	class: className = "",
	style = "",
	children,
}: {
	/** 展开状态（$bindable） */
	open?: boolean;
	/** 查询词（$bindable） */
	query?: string;
	placeholder?: string;
	/** 搜索区域标题（screen reader，多个实例需唯一） */
	label?: string;
	/** 历史搜索（空查询时展示） */
	history?: string[];
	/** 建议项：{ label, icon? } */
	suggestions?: { label: string; icon?: string }[];
	/** true = 全屏覆盖（默认）；false = docked 内嵌卡片 */
	fullScreen?: boolean;
	/** 选择建议/历史项回调 */
	onselect?: (value: string) => void;
	/** 关闭回调 */
	onclose?: () => void;
	class?: string;
	style?: string;
	/** 自定义结果区（默认插槽） */
	children?: import("svelte").Snippet;
} = $props();

let inputEl: HTMLInputElement;
let activeIndex = $state(-1);

function handleKeydown(e: KeyboardEvent) {
	if (e.key === "Escape") {
		activeIndex = -1;
		onclose?.();
		return;
	}
	if (e.key === "ArrowDown" || e.key === "ArrowUp") {
		const list = query ? filteredSuggestions : history;
		if (!list.length) return;
		e.preventDefault();
		activeIndex =
			e.key === "ArrowDown"
				? (activeIndex + 1) % list.length
				: (activeIndex - 1 + list.length) % list.length;
		return;
	}
	if (e.key === "Enter" && activeIndex >= 0) {
		const list = query ? filteredSuggestions : history;
		const item = list[activeIndex];
		if (!item) return;
		e.preventDefault();
		activeIndex = -1;
		pick(typeof item === "string" ? item : item.label);
	}
}

function pick(value: string) {
	query = value;
	onselect?.(value);
}

function clear() {
	query = "";
}

/** 输入时过滤后的建议项 */
const filteredSuggestions = $derived(
	query
		? suggestions.filter((s) =>
				s.label.toLowerCase().includes(query.toLowerCase()),
			)
		: [],
);

/** 打开时自动聚焦输入框（官方 SearchBar 行为） */
$effect(() => {
	if (open && fullScreen) inputEl?.focus();
});

/** 是否有内容可展示：历史（空查询）/ 过滤后的建议 / 自定义插槽；无内容时不渲染横线与内容区（对齐 SearchBar 优化） */
const hasContent = $derived(
	(!query && history.length > 0) ||
		filteredSuggestions.length > 0 ||
		!!children,
);

/** cubic-bezier(x1,y1,x2,y2) easing：Newton-Raphson + 二分求解 */
function cubicBezier(x1: number, y1: number, x2: number, y2: number) {
	const cx = 3 * x1;
	const bx = 3 * (x2 - x1) - cx;
	const ax = 1 - cx - bx;
	const cy = 3 * y1;
	const by = 3 * (y2 - y1) - cy;
	const ay = 1 - cy - by;
	const sampleX = (t: number) => ((ax * t + bx) * t + cx) * t;
	const sampleY = (t: number) => ((ay * t + by) * t + cy) * t;
	const solveX = (x: number) => {
		let t = x;
		for (let i = 0; i < 8; i++) {
			const err = sampleX(t) - x;
			if (Math.abs(err) < 1e-6) return t;
			const d = (3 * ax * t + 2 * bx) * t + cx;
			if (Math.abs(d) < 1e-6) break;
			t -= err / d;
		}
		let lo = 0;
		let hi = 1;
		t = x;
		while (lo < hi) {
			const err = sampleX(t) - x;
			if (Math.abs(err) < 1e-6) return t;
			if (err > 0) hi = t;
			else lo = t;
			t = (lo + hi) / 2;
		}
		return t;
	};
	return (x: number) => sampleY(solveX(x));
}

const emphasizedDecelerate = cubicBezier(0.05, 0.7, 0.1, 1);
const exitEasing = cubicBezier(0, 1, 0, 1);
const standardAccelerate = cubicBezier(0.3, 0, 1, 1);
const standardDecelerate = cubicBezier(0, 0, 0, 1);

/** open 进入：docked = fade + expandVertically，fullScreen = fade */
function searchViewIntro(
	node: HTMLElement,
	{ fullScreen }: { fullScreen: boolean },
): TransitionConfig {
	const height = node.offsetHeight;
	return {
		duration: 600,
		delay: 100,
		easing: emphasizedDecelerate,
		css: (t) =>
			fullScreen
				? `opacity: ${t}`
				: `opacity: ${t}; max-height: ${height * t}px; overflow: hidden;`,
	};
}

/** open 退出：docked = fade + shrinkVertically，fullScreen = fade */
function searchViewOutro(
	node: HTMLElement,
	{ fullScreen }: { fullScreen: boolean },
): TransitionConfig {
	const height = node.offsetHeight;
	return {
		duration: 350,
		delay: 100,
		easing: exitEasing,
		css: (t) =>
			fullScreen
				? `opacity: ${t}`
				: `opacity: ${t}; max-height: ${height * t}px; overflow: hidden;`,
	};
}
</script>

{#if open}
	<div
		class="m3-search-view m3-search-view--{fullScreen ? "full" : "docked"} {className}"
		{style}
		role="search"
		aria-label={label}
		onkeydown={handleKeydown}
		in:searchViewIntro={{ fullScreen }}
		out:searchViewOutro={{ fullScreen }}
	>
		<div class="m3-search-view__header" class:m3-search-view__header--divider={hasContent}>
			<button class="m3-search-view__icon" aria-label="返回" onclick={() => onclose?.()}>
				<Icon icon="material-symbols:arrow-back" />
			</button>
			<input
				bind:this={inputEl}
				bind:value={query}
				class="m3-search-view__input"
				placeholder={placeholder}
				aria-label={label}
				type="text"
			/>
			{#if query}
				<button class="m3-search-view__icon m3-search-view__clear" aria-label="清除" onclick={clear}>
					<Icon icon="material-symbols:close" />
				</button>
			{/if}
		</div>
		{#if hasContent}
		<div
			class="m3-search-view__body"
			in:fade={{ duration: 100, delay: 50, easing: standardAccelerate }}
			out:fade={{ duration: 100, easing: standardDecelerate }}
		>
			{#if !query && history.length}
				<div
					class="m3-search-view__section"
					in:fade={{ duration: 100, delay: 50, easing: standardAccelerate }}
					out:fade={{ duration: 100, easing: standardDecelerate }}
				>
					<div class="m3-search-view__section-label">最近搜索</div>
					{#each history as item, i (item)}
						<button class="m3-search-view__item" class:m3-search-view__item--active={!query && activeIndex === i} onclick={() => pick(item)} onmouseenter={() => (activeIndex = i)}>
							<Icon icon="material-symbols:history" class="m3-search-view__item-icon" />
							<span>{item}</span>
						</button>
					{/each}
				</div>
			{/if}
			{#if query && suggestions.length}
				<div
					class="m3-search-view__section"
					in:fade={{ duration: 100, delay: 50, easing: standardAccelerate }}
					out:fade={{ duration: 100, easing: standardDecelerate }}
				>
					{#each filteredSuggestions as item, i (item.label)}
						<button class="m3-search-view__item" class:m3-search-view__item--active={query && activeIndex === i} onclick={() => pick(item.label)} onmouseenter={() => (activeIndex = i)}>
							{#if item.icon}
								<Icon icon={item.icon} class="m3-search-view__item-icon" />
							{/if}
							<span>{item.label}</span>
						</button>
					{/each}
				</div>
			{/if}
			{@render children?.()}
		</div>
		{/if}
	</div>
{/if}

<style lang="stylus">
.m3-search-view
	display: flex
	flex-direction: column
	box-sizing: border-box
	background: var(--surface-container-high)
	color: var(--on-surface)

	&--full
		position: fixed
		inset: 0
		z-index: 100
		border-radius: 0

		.m3-search-view__header
			height: 4.5rem /* 72px */

	&--docked
		border-radius: var(--shape-corner-xl) /* corner-extra-large 28px */
		box-shadow: var(--m3e-elevation-3)

		.m3-search-view__header
			height: 3.5rem /* 56px */

		.m3-search-view__body
			/* 底部圆角裁剪：与 SearchBar.__expand 对齐，避免内容/hover 背景呈矩形盖过圆角阴影 */
			border-radius: 0 0 var(--shape-corner-xl) var(--shape-corner-xl)

	.m3-search-view__header
		display: flex
		align-items: center
		gap: 0.5rem
		padding: 0 0.5rem
		flex-shrink: 0

		&--divider
			border-bottom: 1px solid var(--outline)
			transition: border-bottom-color 200ms var(--m3e-easing-standard)

	.m3-search-view__icon
		display: inline-flex
		align-items: center
		justify-content: center
		width: 3rem
		height: 3rem
		border: none
		background: transparent
		color: var(--on-surface)
		border-radius: var(--shape-corner-full)
		cursor: pointer
		flex-shrink: 0

		> :global(svg)
			width: 1.5rem
			height: 1.5rem

		&.m3-search-view__clear
			color: var(--on-surface-variant)

	.m3-search-view__input
		flex: 1
		min-width: 0
		border: none
		outline: none
		background: transparent
		color: var(--on-surface)
		font: var(--m3e-type-body-large)
		padding: 0 0.25rem
		box-sizing: border-box

		&::placeholder
			color: var(--on-surface-variant)

	.m3-search-view__body
		overflow-y: auto
		padding: 0.5rem 0

	.m3-search-view__section-label
		padding: 0.75rem 1.5rem 0.25rem
		font: var(--m3e-type-body-large)
		color: var(--on-surface-variant)

	.m3-search-view__item
		display: flex
		align-items: center
		gap: 1rem
		width: 100%
		padding: 0.75rem 1.5rem
		border: none
		background: transparent
		color: var(--on-surface)
		font: var(--m3e-type-body-large)
		text-align: start
		cursor: pointer

		&:hover
			background: unquote("color-mix(in oklab, var(--on-surface) 8%, transparent)")

		&--active
			background: unquote("color-mix(in oklab, var(--on-surface) 12%, transparent)")

		.m3-search-view__item-icon
			width: 1.5rem
			height: 1.5rem
			color: var(--on-surface-variant)
			flex-shrink: 0
</style>