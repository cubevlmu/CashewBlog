<script lang="ts">
import Icon from "@iconify/svelte";

/**
 * M3E Tabs — 标签页（官方 M3 Tabs 移植，对齐 material-web 实测）：
 * - primary（默认）：Surface 容器 + 底部 1dp divider，48dp（带图标 64dp、图标上置）；
 *   激活指示器 3dp、primary 色、圆角 3,3,0,0，宽度 = 标签内容宽（最小 24dp），切换时滑动；
 *   激活项 primary、未激活 on-surface-variant，state layer hover/focus/pressed。
 * - secondary：48dp 纯文字（inline 图标可用），指示器 2dp、primary 色、方角、整格全宽；
 *   激活项 on-surface，未激活 on-surface-variant。
 * - scrollable：内容宽 tab（最小 90dp）、起始边缘留白 52dp，溢出横向滚动（隐藏滚动条），
 *   选中 tab 自动滚动居中（对齐官方 ScrollableTabRow）。
 * 标签字体官方为 title-small（14px/20px/500）。
 * items: {value, label, icon?}[]（icon 为 Iconify 图标名），value $bindable，onchange 回调；
 * 支持方向键/Home/End 切换（ARIA tabs 模式）。
 */
let {
	value = $bindable(""),
	items = [] as { value: string; label: string; icon?: string }[],
	variant = "primary",
	scrollable = false,
	onchange,
	class: className = "",
}: {
	/** 激活 tab 的 value（$bindable），空值或未命中时自动选中第一个 */
	value?: string;
	items: { value: string; label: string; icon?: string }[];
	/** primary（默认）/ secondary */
	variant?: "primary" | "secondary";
	/** scrollable：内容宽 tab（最小 90dp）、边缘 52dp、选中居中滚动 */
	scrollable?: boolean;
	onchange?: (value: string) => void;
	class?: string;
} = $props();

if ((!value || !items.some((t) => t.value === value)) && items.length) {
	value = items[0].value;
}

const hasIcon = $derived(items.some((t) => t.icon));

let rootEl = $state<HTMLElement>();
let indicator = $state({ left: 0, width: 0, ready: false });

function select(v: string) {
	if (v === value) return;
	value = v;
	onchange?.(v);
}

function measureIndicator() {
	const root = rootEl;
	if (!root) return;
	const idx = items.findIndex((t) => t.value === value);
	if (idx < 0) return;
	const tab = root.querySelectorAll<HTMLElement>(".m3-tabs__tab")[idx];
	if (!tab) return;
	const rr = root.getBoundingClientRect();
	const scrolled = root.scrollLeft; /* 指示器在滚动内容内，需用内容坐标 */
	if (variant === "secondary") {
		const tr = tab.getBoundingClientRect();
		indicator = {
			left: tr.left - rr.left + scrolled,
			width: tr.width,
			ready: true,
		};
		return;
	}
	const content = tab.querySelector<HTMLElement>(".m3-tabs__tab-content");
	if (!content) return;
	const cr = content.getBoundingClientRect();
	const width = Math.max(cr.width, 24);
	indicator = {
		left: cr.left - rr.left + scrolled + (cr.width - width) / 2,
		width,
		ready: true,
	};
}

let scrolledOnce = false;
let scrollTimer: ReturnType<typeof setTimeout> | undefined;
$effect(() => {
	const root = rootEl;
	if (!root) return;
	measureIndicator();
	/* 延迟一拍再滚动：避开浏览器原生 focus 滚动（它会取消我们的 scrollTo） */
	clearTimeout(scrollTimer);
	scrollTimer = setTimeout(
		() =>
			scrollActiveIntoView(
				scrolledOnce ? "smooth" : ("instant" as ScrollBehavior),
			),
		0,
	);
	scrolledOnce = true;
	const ro = new ResizeObserver(() => measureIndicator());
	ro.observe(root);
	for (const c of root.querySelectorAll<HTMLElement>(".m3-tabs__tab-content"))
		ro.observe(c);
	return () => {
		clearTimeout(scrollTimer);
		ro.disconnect();
	};
});

function scrollActiveIntoView(behavior: ScrollBehavior = "smooth") {
	const root = rootEl;
	if (!root || !scrollable) return;
	const idx = items.findIndex((t) => t.value === value);
	if (idx < 0) return;
	const tab = root.querySelectorAll<HTMLElement>(".m3-tabs__tab")[idx];
	if (!tab) return;
	const rr = root.getBoundingClientRect();
	const tr = tab.getBoundingClientRect();
	const tabLeft =
		tr.left - rr.left + root.scrollLeft; /* 内容坐标，避免与滚动动画竞态 */
	const tabWidth = tr.width;
	const visible = root.clientWidth;
	const maxScroll = root.scrollWidth - visible;
	const centered = tabLeft - (visible - tabWidth) / 2;
	const to = Math.max(0, Math.min(centered, maxScroll));
	if (Math.abs(root.scrollLeft - to) > 0.5) {
		root.scrollTo({ left: to, behavior });
	}
}

function onKeydown(e: KeyboardEvent, idx: number) {
	if (!["ArrowRight", "ArrowLeft", "Home", "End"].includes(e.key)) return;
	e.preventDefault();
	let next: number;
	if (e.key === "Home") next = 0;
	else if (e.key === "End") next = items.length - 1;
	else if (e.key === "ArrowRight") next = (idx + 1) % items.length;
	else next = (idx - 1 + items.length) % items.length;
	select(items[next].value);
	rootEl?.querySelectorAll<HTMLElement>(".m3-tabs__tab")[next]?.focus();
}
</script>

<div
	bind:this={rootEl}
	class="m3-tabs m3-tabs--{variant} {className}"
	class:m3-tabs--icon={variant === "primary" && hasIcon}
	class:m3-tabs--scrollable={scrollable}
	role="tablist"
>
	<span
		class="m3-tabs__indicator"
		class:m3-tabs__indicator--ready={indicator.ready}
		style={`left: ${indicator.left}px; width: ${indicator.width}px`}
		aria-hidden="true"
	></span>
	{#each items as tab, i (tab.value)}
		<button
			type="button"
			class="m3-tabs__tab m3-state-layer"
			class:m3-tabs__tab--active={value === tab.value}
			role="tab"
			aria-selected={value === tab.value}
			tabindex={value === tab.value ? 0 : -1}
			onclick={() => select(tab.value)}
			onkeydown={(e) => onKeydown(e, i)}
		>
			<span class="m3-tabs__tab-content">
				{#if tab.icon}
					<span class="m3-tabs__tab-icon"><Icon icon={tab.icon} /></span>
				{/if}
				<span class="m3-tabs__tab-label">{tab.label}</span>
			</span>
		</button>
	{/each}
</div>

<style lang="stylus">
.m3-tabs
	position: relative
	display: flex
	width: 100%
	box-sizing: border-box
	height: 48px
	overflow: hidden
	background: var(--surface)
	box-shadow: inset 0 -1px 0 var(--outline-variant) /* 底部 1dp divider（含在高度内） */

	&--icon
		height: 64px

	&--scrollable
		overflow-x: auto
		overflow-y: hidden
		scroll-behavior: smooth
		scrollbar-width: none
		padding-inline: 52px /* 官方 ScrollableTabRow 边缘留白 52dp */

		&::-webkit-scrollbar
			display: none

		.m3-tabs__tab
			flex: 0 0 auto
			min-width: 90px /* 官方 ScrollableTabRow 最小 tab 宽 90dp */

	&__tab
		flex: 1 1 0
		min-width: 0
		display: flex
		align-items: center
		justify-content: center
		padding: 0 16px
		border: none
		background: none
		color: var(--on-surface-variant)
		font: var(--m3e-type-title-small)
		cursor: pointer
		--m3e-state-color: var(--on-surface)
		transition: color var(--m3e-duration-short) var(--m3e-easing-standard)

		&--active
			color: var(--primary)

	&__tab-content
		display: inline-flex
		align-items: center
		justify-content: center
		gap: 8px
		min-width: 0
		max-width: 100%

	&__tab-icon
		display: inline-flex
		flex: none

		> :global(svg)
			width: 24px
			height: 24px

	&__tab-label
		min-width: 0
		white-space: nowrap
		overflow: hidden
		text-overflow: ellipsis

	&--primary &__tab-content
		flex-direction: column
		gap: 2px /* 官方 stacked：图标上置，间距 2dp */

	&__indicator
		position: absolute
		bottom: 1px /* 在 1dp divider 之上 */
		height: 3px
		border-radius: 3px 3px 0 0
		background: var(--primary)
		pointer-events: none
		opacity: 0

		&--ready
			opacity: 1
			transition:
				opacity var(--m3e-duration-short) var(--m3e-easing-standard),
				left var(--m3e-duration-medium) var(--m3e-easing-emphasized-decelerate),
				width var(--m3e-duration-medium) var(--m3e-easing-emphasized-decelerate)

	&--secondary
		.m3-tabs__tab--active
			color: var(--on-surface)

		.m3-tabs__tab-content
			flex-direction: row
			gap: 8px

		.m3-tabs__indicator
			height: 2px
			border-radius: 0
</style>
