<script lang="ts">
/**
 * M3E Tooltip — 提示气泡原子（官方 PlainTooltipTokens / RichTooltipTokens）。
 * 包裹式：<Tooltip variant="plain" label="提示">锚点</Tooltip>
 * 锚点 hover / focus / touch 时在全局顶层（document.body 挂载）计算视口坐标显示，
 * 彻底避免受父容器 overflow: hidden 裁剪与局部 stacking context 层级遮挡。
 *
 * 变体：
 * - plain（默认）：inverse-surface + corner-xs + body-small，无阴影，不拦截底层指针事件
 * - rich：surface-container + corner-medium + elevation-2，title（title-small）
 *   + supporting（body-medium）+ 可选 action（primary, label-large）
 * 方向：placement="bottom"（默认，向下弹出）/ "top"（向上弹出，
 * 用于卡片底部等下方空间不足的锚点，如音乐播放器控制栏与资料卡社交图标）。
 * 当视口边界空间不足时自动翻转与内缩（边界碰撞保护）。
 */
import { onMount, tick } from "svelte";

let {
	variant = "plain",
	label = "",
	title = "",
	supporting = "",
	action = null,
	placement = "bottom",
	class: className = "",
	children,
}: {
	variant?: "plain" | "rich";
	label?: string;
	title?: string;
	supporting?: string;
	action?: { label: string; onClick: () => void } | null;
	/** 弹出方向：bottom（锚点下方，默认）/ top（锚点上方） */
	placement?: "top" | "bottom";
	class?: string;
	children?: import("svelte").Snippet;
} = $props();

let open = $state(false);
let wrapEl = $state<HTMLSpanElement | null>(null);
let tipEl = $state<HTMLSpanElement | null>(null);
const tipId = `m3e-tooltip-${Math.random().toString(36).slice(2, 9)}`;

let tipX = $state(0);
let tipY = $state(0);
let actualPlacement = $state<"top" | "bottom">("bottom");

let hoverTimer: ReturnType<typeof setTimeout> | null = null;
let touchDismissTimer: ReturnType<typeof setTimeout> | null = null;

function clearTimers() {
	if (hoverTimer) {
		clearTimeout(hoverTimer);
		hoverTimer = null;
	}
	if (touchDismissTimer) {
		clearTimeout(touchDismissTimer);
		touchDismissTimer = null;
	}
}

function updatePosition() {
	if (!wrapEl || !tipEl) return;
	const anchorRect = wrapEl.getBoundingClientRect();
	const tipRect = tipEl.getBoundingClientRect();
	const viewportWidth = window.innerWidth;
	const viewportHeight = window.innerHeight;
	const margin = 8;
	const gap = 6;

	// 水平居中并限制在视口边距范围内，避免右侧/左侧截断
	const anchorCenterX = anchorRect.left + anchorRect.width / 2;
	let left = anchorCenterX - tipRect.width / 2;
	left = Math.max(
		margin,
		Math.min(left, viewportWidth - tipRect.width - margin),
	);

	// 垂直方向根据 placement 计算，空间不足时自动翻转
	let top = 0;
	let place = placement;
	if (placement === "top") {
		top = anchorRect.top - tipRect.height - gap;
		if (top < margin) {
			top = anchorRect.bottom + gap;
			place = "bottom";
		}
	} else {
		top = anchorRect.bottom + gap;
		if (top + tipRect.height > viewportHeight - margin) {
			top = anchorRect.top - tipRect.height - gap;
			place = "top";
		}
	}

	tipX = Math.round(left);
	tipY = Math.round(top);
	actualPlacement = place;
}

function show() {
	if (!label && !title && !supporting) return;
	clearTimers();
	open = true;
	tick().then(updatePosition);
}

function hide() {
	clearTimers();
	open = false;
}

function onMouseEnter() {
	clearTimers();
	hoverTimer = setTimeout(() => {
		show();
	}, 300);
}

function onMouseLeave() {
	hide();
}

function onFocusIn(e: FocusEvent) {
	const target = e.target as HTMLElement | null;
	if (target && wrapEl?.contains(target)) {
		target.setAttribute("aria-describedby", tipId);
		show();
	}
}

function onFocusOut(e: FocusEvent) {
	const target = e.target as HTMLElement | null;
	target?.removeAttribute("aria-describedby");
	const related = e.relatedTarget as Node | null;
	if (!related || !wrapEl?.contains(related)) {
		hide();
	}
}

function onPointerDown(e: PointerEvent) {
	if (e.pointerType === "touch") {
		if (open) {
			hide();
		} else {
			show();
			touchDismissTimer = setTimeout(hide, 2500);
		}
	}
}

function onActionClick() {
	action?.onClick();
	hide();
}

onMount(() => {
	// 将气泡元素挂载至 body 顶层，彻底脱离父级 overflow 截断与局部层叠上下文
	if (tipEl && tipEl.parentNode !== document.body) {
		document.body.appendChild(tipEl);
	}

	const onScrollOrResize = () => {
		if (open) updatePosition();
	};
	const onKeydown = (e: KeyboardEvent) => {
		if (e.key === "Escape" && open) hide();
	};
	const onDocPointerDown = (e: PointerEvent) => {
		if (!open) return;
		const target = e.target as Node | null;
		if (target && !wrapEl?.contains(target) && !tipEl?.contains(target)) {
			hide();
		}
	};

	window.addEventListener("scroll", onScrollOrResize, {
		passive: true,
		capture: true,
	});
	window.addEventListener("resize", onScrollOrResize, { passive: true });
	window.addEventListener("keydown", onKeydown);
	document.addEventListener("pointerdown", onDocPointerDown);

	return () => {
		clearTimers();
		window.removeEventListener("scroll", onScrollOrResize, { capture: true });
		window.removeEventListener("resize", onScrollOrResize);
		window.removeEventListener("keydown", onKeydown);
		document.removeEventListener("pointerdown", onDocPointerDown);
		tipEl?.remove();
	};
});

$effect(() => {
	if (open) {
		tick().then(updatePosition);
	}
});
</script>

<span
	class={`m3-tooltip ${className}`}
	bind:this={wrapEl}
	onmouseenter={onMouseEnter}
	onmouseleave={onMouseLeave}
	onfocusin={onFocusIn}
	onfocusout={onFocusOut}
	onpointerdown={onPointerDown}
>
		{@render children?.()}
</span>

<span
	class={`m3-tooltip__tip m3-tooltip__tip--${variant}${open ? " m3-tooltip__tip--open" : ""}${actualPlacement === "top" ? " m3-tooltip__tip--top" : " m3-tooltip__tip--bottom"}`}
	id={tipId}
	role="tooltip"
	aria-hidden={!open}
	bind:this={tipEl}
	style={`left: ${tipX}px; top: ${tipY}px;`}
>
	{#if variant === "rich"}
		{#if title}
			<span class="m3-tooltip__title">{title}</span>
		{/if}
		{#if supporting}
			<span class="m3-tooltip__supporting">{supporting}</span>
		{/if}
		{#if action}
			<button type="button" class="m3-tooltip__action" onclick={onActionClick}>{action.label}</button>
		{/if}
	{:else}
		{label}
	{/if}
</span>

<style lang="stylus">
.m3-tooltip
	position: relative
	display: inline-flex

.m3-tooltip__tip
	position: fixed
	top: 0
	left: 0
	margin: 0
	max-width: 18rem
	padding: 0.375rem 0.75rem
	border-radius: var(--shape-corner-xs)
	background: var(--inverse-surface)
	color: var(--inverse-on-surface)
	font: var(--m3e-type-body-small)
	text-align: left
	white-space: nowrap
	overflow-wrap: anywhere
	z-index: 120
	opacity: 0
	pointer-events: none
	box-shadow: var(--m3e-elevation-1)
	transform: scale(0.96)
	transition:
		opacity var(--m3e-duration-short) var(--m3e-easing-standard),
		transform var(--m3e-duration-short) var(--m3e-easing-standard)

	&--open
		opacity: 1
		transform: scale(1)

	&--rich
		display: flex
		flex-direction: column
		gap: 0.25rem
		max-width: 20rem
		padding: 1rem
		border-radius: var(--shape-corner-m)
		background: var(--surface-container)
		color: var(--on-surface)
		box-shadow: var(--m3e-elevation-2)
		white-space: normal

	&--rich.m3-tooltip__tip--open
		pointer-events: auto

	&__title
		font: var(--m3e-type-title-small)
		color: var(--on-surface-variant)

	&__supporting
		font: var(--m3e-type-body-medium)
		color: var(--on-surface-variant)

	&__action
		align-self: flex-start
		margin-top: 0.25rem
		padding: 0.25rem 0.5rem
		border: none
		background: none
		color: var(--primary)
		font: var(--m3e-type-label-large)
		cursor: pointer
		border-radius: var(--shape-corner-xs)
		&:hover
			background: unquote("color-mix(in srgb, var(--primary) 8%, transparent)")
		&:focus-visible
			outline: 2px solid var(--primary)
			outline-offset: 2px
</style>
