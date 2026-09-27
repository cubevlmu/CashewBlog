<script lang="ts">
import Icon from "@iconify/svelte";

/**
 * M3E FAB — M3 悬浮操作按钮原子（官方 FloatingActionButton / ExtendedFloatingActionButton 移植，
 * token 对齐 v0.192 md-comp-{fab,extended-fab}-{primary,secondary,tertiary,surface} + Compose latest 尺寸）：
 * - 四种官方变体：primary（primary-container 实底 + on-primary-container）/ secondary（secondary-container）/
 *   tertiary（tertiary-container）/ surface（surface-container-high + primary 图标）；
 * - 尺寸（图标形态）：small 40/图标24、regular 56/24（默认）、large 96/36（v0.192 large-icon-size）；
 * - Extended 形态（传入 label）：small 与 regular 同为 56 高、large 96 高；label-large、leading 16 + icon-label 8 + trailing 20；
 * - 高度：默认 level3、hover level4、pressed/focus level3；`lowered` 用 level1（hover level2）；
 * - 交互：原生 button + m3-state-layer（hover/focus/pressed）；图标模式可用 ariaLabel 设置无障碍标签；
 * - 通用场景：页面主操作、返回顶部、撰写/发布等核心动作。
 */
let {
	children,
	icon = "",
	label = "",
	ariaLabel = "",
	variant = "primary",
	size = "regular",
	lowered = false,
	disabled = false,
	type = "button",
	onclick,
	class: className = "",
	style = "",
	radius = "",
}: {
	/** 图标内容插槽（优先于 icon prop；SSR 静态场景请用此方式传入 astro-icon 等已渲染图标，尺寸由调用方 class 控制） */
	children?: import("svelte").Snippet;
	/** 图标（Iconify 名；仅客户端水合场景可用，SSR 无水合时图标不会加载） */
	icon?: string;
	/** 可见文本：传入即变为 Extended FAB（含图标） */
	label?: string;
	/** 无障碍标签（图标模式下默认取 label 或 icon） */
	ariaLabel?: string;
	/** 变体：primary（默认）/ secondary / tertiary / surface */
	variant?: "primary" | "secondary" | "tertiary" | "surface";
	/** 尺寸：small 40 / regular 56（默认）/ large 96；Extended 时 small 与 regular 同为 56 高、large 96 高 */
	size?: "small" | "regular" | "large";
	/** 降低高度（官方 lowered FAB：level1，hover level2） */
	lowered?: boolean;
	disabled?: boolean;
	/** 原生 type：button（默认）/ submit / reset */
	type?: "button" | "submit" | "reset";
	onclick?: () => void;
	class?: string;
	/** 圆角覆盖：不传跟随官方尺寸默认；token 名 m/l/xl/full 或任意 CSS 长度（如 "24px"） */
	radius?: string;
	style?: string;
} = $props();

/** 圆角 token 名 → 设计令牌；其他值按 CSS 原样传入 */
const RADIUS_TOKENS: Record<string, string> = {
	m: "var(--shape-corner-m)",
	l: "var(--shape-corner-l)",
	xl: "var(--shape-corner-xl)",
	full: "var(--shape-corner-full)",
};
const radiusVar = (r: string) => RADIUS_TOKENS[r] ?? r;
</script>

<button
	type={type}
	class="m3-fab m3-fab--{variant} m3-fab--{size} m3-state-layer {className}"
	class:m3-fab--extended={!!label}
	class:m3-fab--lowered={lowered}
	class:m3-fab--disabled={disabled}
	style={radius ? `--m3-fab-radius: ${radiusVar(radius)}; ${style}` : style}
	aria-label={ariaLabel || label || icon || undefined}
	disabled={disabled}
	onclick={onclick}
>
	{#if icon}
		<span class="m3-fab__icon" aria-hidden="true"><Icon icon={icon} /></span>
	{:else if children}
		{@render children()}
	{/if}
	{#if label}
		<span class="m3-fab__label">{label}</span>
	{/if}
</button>

<style lang="stylus">
.m3-fab
	display: inline-flex
	align-items: center
	justify-content: center
	box-sizing: border-box
	gap: 0.5rem /* icon 与 label 间距 8px（ExtendedFab IconLabelSpace） */
	padding: 0
	border: none
	border-radius: var(--m3-fab-radius, var(--shape-corner-l)) /* corner-large 16px */
	background: var(--primary-container)
	color: var(--on-primary-container)
	font: var(--m3e-type-label-large)
	cursor: pointer
	flex-shrink: 0
	user-select: none
	white-space: nowrap
	-webkit-tap-highlight-color: transparent
	--m3e-state-color: var(--on-primary-container)
	--m3-fab-elevation: var(--m3e-elevation-3)
	box-shadow: var(--m3-fab-elevation)
	transition:
		box-shadow var(--m3e-duration-short) var(--m3e-easing-standard),
		background-color var(--m3e-duration-short) var(--m3e-easing-standard),
		color var(--m3e-duration-short) var(--m3e-easing-standard)

	&__icon
		display: inline-flex
		align-items: center
		justify-content: center
		flex-shrink: 0

		> :global(svg)
			width: 1.5rem /* 24px */
			height: 1.5rem

	&:hover
		--m3-fab-elevation: var(--m3e-elevation-4) /* hover-container-elevation level4 */

	&--disabled
		pointer-events: none
		opacity: 0.38

	/* === 尺寸（图标形态） === */
	&--small
		width: 2.5rem /* 40px */
		height: 2.5rem
		border-radius: var(--m3-fab-radius, var(--shape-corner-m)) /* corner-medium 12px */

	&--regular
		width: 3.5rem /* 56px */
		height: 3.5rem

	&--large
		width: 6rem /* 96px */
		height: 6rem
		border-radius: var(--m3-fab-radius, var(--shape-corner-xl)) /* corner-extra-large 28px */

		.m3-fab__icon > :global(svg)
			width: 2.25rem /* 36px（v0.192 large-icon-size） */
			height: 2.25rem

	/* === Extended 形态 === */
	&--extended
		width: auto
		min-width: 5rem /* 80px 最小宽度 */
		height: 3.5rem /* 56px */
		padding: 0 1.25rem 0 1rem /* trailing 20px / leading 16px */
		border-radius: var(--m3-fab-radius, var(--shape-corner-l)) /* corner-large 16px */

		&.m3-fab--large
			height: 6rem /* 96px */
			padding: 0 1.75rem /* 28px */
			border-radius: var(--m3-fab-radius, var(--shape-corner-xl))

			.m3-fab__icon > :global(svg)
				width: 2.25rem
				height: 2.25rem

	/* === 变体（v0.192 tokens） === */
	&--primary
		background: var(--primary-container)
		color: var(--on-primary-container)
		--m3e-state-color: var(--on-primary-container)

	&--secondary
		background: var(--secondary-container)
		color: var(--on-secondary-container)
		--m3e-state-color: var(--on-secondary-container)

	&--tertiary
		background: var(--tertiary-container)
		color: var(--on-tertiary-container)
		--m3e-state-color: var(--on-tertiary-container)

	&--surface
		background: var(--surface-container-high)
		color: var(--primary)
		--m3e-state-color: var(--primary)

	/* === 降低高度（lowered FAB：level1 / hover level2） === */
	&--lowered
		--m3-fab-elevation: var(--m3e-elevation-1)

		&:hover
			--m3-fab-elevation: var(--m3e-elevation-2)
</style>