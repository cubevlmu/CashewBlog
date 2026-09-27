<script lang="ts">
/**
 * M3E SheetSide — M3 侧边弹层原子（官方 SheetSide / ModalSideSheet 移植，token 对齐 v0.192 md-comp-sheet-side）：
 * - 面板从 end（默认右侧，LTR）滑入，全高，width 默认 360px（官方 ModalContainerWidth）；
 * - 容器 surface-container-low + elevation level1 + corner-large-start（仅起始侧大圆角，官方 ShapeCornerLargeStart）；
 * - 标题 title-large on-surface-variant（官方 headline），内容区 overflow 滚动；
 * - 遮罩淡入 + Esc / 遮罩点击关闭（onclose 或 open $bindable 置 false）。
 */
let {
	open = $bindable(false),
	title,
	side = "end",
	width = "360px",
	scrim = true,
	onclose,
	class: className = "",
	style = "",
	children,
}: {
	/** 弹层开关（$bindable），遮罩点击 / Esc 自动置 false */
	open?: boolean;
	/** 标题（可选，title-large） */
	title?: string;
	/** 面板侧：end（默认，LTR 右侧）/ start（左侧） */
	side?: "end" | "start";
	/** 面板宽度（默认 360px） */
	width?: string;
	/** 是否显示遮罩（false = 无遮罩的 persistent 风格） */
	scrim?: boolean;
	/** 关闭回调（Esc / 遮罩点击） */
	onclose?: () => void;
	class?: string;
	style?: string;
	children?: import("svelte").Snippet;
} = $props();

let panelEl = $state<HTMLElement>();
let lastFocused: HTMLElement | null = null;

function getFocusables(): HTMLElement[] {
	const panel = panelEl;
	if (!panel) return [];
	return [
		...panel.querySelectorAll<HTMLElement>(
			'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
		),
	].filter((el) => el.offsetParent !== null);
}

/** 打开时：聚焦面板 + 焦点陷阱（Tab 循环）；关闭后焦点返还触发元素（官方 Modal Sheet） */
$effect(() => {
	if (!open) return;
	lastFocused = document.activeElement as HTMLElement | null;
	const t = setTimeout(() => panelEl?.focus(), 0);
	function onKey(e: KeyboardEvent) {
		if (e.key === "Escape") {
			open = false;
			onclose?.();
			return;
		}
		if (e.key !== "Tab") return;
		const items = getFocusables();
		if (!items.length) return;
		const first = items[0];
		const last = items[items.length - 1];
		const active = document.activeElement;
		if (e.shiftKey && (active === first || !panelEl?.contains(active))) {
			e.preventDefault();
			last.focus();
		} else if (!e.shiftKey && (active === last || !panelEl?.contains(active))) {
			e.preventDefault();
			first.focus();
		}
	}
	window.addEventListener("keydown", onKey);
	return () => {
		clearTimeout(t);
		window.removeEventListener("keydown", onKey);
		lastFocused?.focus();
	};
});

function handleScrim() {
	open = false;
	onclose?.();
}
</script>

<div
	class="m3-sheet-side-root {className}"
	class:m3-sheet-side-root--open={open}
	class:m3-sheet-side-root--nostrip={!scrim}
	style={width ? `--m3-sheet-side-width: ${width}; ${style}` : style}
>
	{#if scrim}
		<div class="m3-sheet-side__scrim" aria-hidden="true" onclick={handleScrim}></div>
	{/if}
	<div bind:this={panelEl} tabindex="-1" class="m3-sheet-side m3-sheet-side--{side}" role="dialog" aria-modal="true" aria-label={title ?? "侧边弹层"}>
		{#if title}
			<div class="m3-sheet-side__title">{title}</div>
		{/if}
		<div class="m3-sheet-side__content">
			{@render children?.()}
		</div>
	</div>
</div>

<style lang="stylus">
.m3-sheet-side-root
	position: fixed
	inset: 0
	z-index: 70
	visibility: hidden
	pointer-events: none

	&.m3-sheet-side-root--open
		visibility: visible
		pointer-events: auto

	.m3-sheet-side__scrim
		position: absolute
		inset: 0
		background: unquote("color-mix(in oklab, var(--scrim, #000) 32%, transparent)")
		opacity: 0
		transition: opacity var(--m3e-duration-medium) var(--m3e-easing-standard)

	&.m3-sheet-side-root--open .m3-sheet-side__scrim
		opacity: 1

	/* 面板：end 侧滑入，全高，corner-large-start */
	.m3-sheet-side
		position: absolute
		top: 0
		bottom: 0
		width: var(--m3-sheet-side-width, 360px)
		max-width: 100vw
		box-sizing: border-box
		display: flex
		flex-direction: column
		background: var(--surface-container-low)
		color: var(--on-surface)
		box-shadow: var(--m3e-elevation-1)
		transition: transform var(--m3e-duration-long) var(--m3e-easing-emphasized-decelerate)

		&--end
			right: 0
			border-radius: var(--shape-corner-l) 0 0 var(--shape-corner-l) /* corner-large-start */
			transform: translateX(100%)

		&--start
			left: 0
			border-radius: 0 var(--shape-corner-l) var(--shape-corner-l) 0
			transform: translateX(-100%)

	&.m3-sheet-side-root--open .m3-sheet-side--end
		transform: translateX(0)

	&.m3-sheet-side-root--open .m3-sheet-side--start
		transform: translateX(0)

	.m3-sheet-side__title
		flex: none
		padding: 1.5rem 1.5rem 0.5rem
		font: var(--m3e-type-title-large)
		color: var(--on-surface-variant)

	.m3-sheet-side__content
		flex: 1
		min-height: 0
		padding: 0.5rem 1.5rem 1.5rem
		overflow-y: auto
</style>