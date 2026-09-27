<script lang="ts">
import Icon from "@iconify/svelte";

/**
 * M3E Button — M3 按钮原子（官方 Button 移植，token 对齐 v0.192 md-comp-{filled,elevated,filled-tonal,outlined,text}-button + latest 尺寸变体）：
 * - 五种官方变体：filled（primary 实底 + on-primary）/ elevated（surface-container-low + primary，默认 elevation-1）/
 *   tonal（secondary-container 实底）/ outlined（透明 + outline 描边）/ text（透明无描边）；
 * - 尺寸对齐 latest：xsmall 32/图标20、small 40/20（默认）、medium 56/24、large 96/32、xlarge 136/40；
 * - 可选 leading 图标（Iconify，18px 基础，随尺寸缩放）；label-large 文本；
 * - 圆角默认 12px（站点形状契约 --shape-corner-m），`radius` prop 可覆盖（胶囊等官方形态）；
 * - `children` snippet 插槽（优先于 label 渲染；SSR 静态场景用此方式传 astro-icon 等已渲染图标）；
 * - `href` 提供时渲染 <a>（原生语义，带 target/rel）；`full` 占满宽度；`align` 控制内容对齐（center/start/between）；
 * - 交互：原生 button + m3-state-layer（hover/focus/pressed）；filled/elevated/tonal hover 阴影提升（level0→1 / 1→2）；
 * - disabled 对齐官方：filled/elevated/tonal 容器 12% + 文字/图标 38%（分开控制，避免全局状态层双重透明）；
 *   outlined 边框 12% + 文字 38%；text 文字 38%；
 * - 通用场景：页面主操作、表单提交、工具条动作等。
 */
let {
	children,
	label = "",
	icon = "",
	variant = "filled",
	size = "small",
	full = false,
	align = "center",
	ariaLabel = "",
	disabled = false,
	type = "button",
	href = undefined,
	target = undefined,
	rel = undefined,
	onclick,
	class: className = "",
	style = "",
	radius = "",
}: {
	/** 内容插槽（优先于 label；SSR 静态场景请用此方式传入 astro-icon 等已渲染图标） */
	children?: import("svelte").Snippet;
	/** 按钮文本（label-large） */
	label?: string;
	/** 可选 leading 图标（Iconify 名） */
	icon?: string;
	/** 变体：filled（默认）/ elevated / tonal / outlined / text */
	variant?: "filled" | "elevated" | "tonal" | "outlined" | "text";
	/** 尺寸：xsmall 32 / small 40（默认）/ medium 56 / large 96 / xlarge 136 */
	size?: "xsmall" | "small" | "medium" | "large" | "xlarge";
	/** 占满容器宽度 */
	full?: boolean;
	/** 内容对齐：center（默认）/ start（左）/ between（children 两端） */
	align?: "center" | "start" | "between";
	/** 无障碍标签（children 有可见文字但需完整无障碍名时使用） */
	ariaLabel?: string;
	disabled?: boolean;
	/** 原生 type：button（默认）/ submit / reset */
	type?: "button" | "submit" | "reset";
	/** 提供时渲染为 <a>（导航/外部链接，遵循「href → <a>」原生语义） */
	href?: string;
	/** 链接 target（仅 href 时生效） */
	target?: string;
	/** 链接 rel（仅 href 时生效） */
	rel?: string;
	onclick?: () => void;
	class?: string;
	/** 圆角覆盖：不传为站点契约 12px（--shape-corner-m）；token 名 m/l/xl/full 或任意 CSS 长度 */
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

{#if href}
	<a
		href={href}
		target={target}
		rel={rel}
		class="m3-button m3-button--{variant} m3-button--{size} m3-button--{align} m3-state-layer {className}"
		class:m3-button--full={full}
		style={radius ? `--m3-button-radius: ${radiusVar(radius)}; ${style}` : style}
		aria-label={ariaLabel || undefined}
		onclick={onclick}
	>
		{#if icon}
			<span class="m3-button__icon" aria-hidden="true"><Icon icon={icon} /></span>
		{/if}
		{#if children}
			<span class="m3-button__content">{@render children()}</span>
		{:else if label}
			<span class="m3-button__label">{label}</span>
		{/if}
	</a>
{:else}
	<button
		type={type}
		class="m3-button m3-button--{variant} m3-button--{size} m3-button--{align} m3-state-layer {className}"
		class:m3-button--full={full}
		class:m3-button--disabled={disabled}
		style={radius ? `--m3-button-radius: ${radiusVar(radius)}; ${style}` : style}
		aria-label={ariaLabel || undefined}
		disabled={disabled}
		onclick={onclick}
	>
		{#if icon}
			<span class="m3-button__icon" aria-hidden="true"><Icon icon={icon} /></span>
		{/if}
		{#if children}
			<span class="m3-button__content">{@render children()}</span>
		{:else if label}
			<span class="m3-button__label">{label}</span>
		{/if}
	</button>
{/if}

<style lang="stylus">
.m3-button
	display: inline-flex
	align-items: center
	justify-content: center
	box-sizing: border-box
	gap: 0.5rem /* icon 与 label 间距 8px */
	height: 2.5rem /* small 40px */
	padding: 0 1.5rem /* small 水平 24px */
	border: none
	border-radius: var(--m3-button-radius, var(--shape-corner-m)) /* 站点形状契约 12px，radius prop 可覆盖 */
	background: transparent
	color: var(--primary)
	font: var(--m3e-type-label-large)
	cursor: pointer
	user-select: none
	white-space: nowrap
	text-decoration: none
	flex-shrink: 0
	-webkit-tap-highlight-color: transparent
	--m3e-state-color: var(--primary)
	--m3-button-elevation: var(--m3e-elevation-0)
	box-shadow: var(--m3-button-elevation)
	transition:
		box-shadow var(--m3e-duration-short) var(--m3e-easing-standard),
		background-color var(--m3e-duration-short) var(--m3e-easing-standard),
		color var(--m3e-duration-short) var(--m3e-easing-standard),
		border-color var(--m3e-duration-short) var(--m3e-easing-standard)

	&__icon
		display: inline-flex
		align-items: center
		justify-content: center
		flex-shrink: 0

		> :global(svg)
			width: 1.125rem /* 18px 基础 */
			height: 1.125rem

	/* children 插槽内容容器（对齐 / 占满由 align + full 控制） */
	&__content
		display: flex
		flex: 1
		align-items: center
		gap: 0.5rem
		min-width: 0

	&--center &__content
		justify-content: center

	&--start &__content
		justify-content: flex-start

	&--between &__content
		justify-content: space-between

	&--full
		width: 100%

	&--disabled
		pointer-events: none

	/* === 尺寸（latest md-comp-button-*） === */
	&--xsmall
		height: 2rem /* 32px */
		padding: 0 1rem

		.m3-button__icon > :global(svg)
			width: 1.25rem /* 20px */
			height: 1.25rem

	&--small
		height: 2.5rem /* 40px */
		padding: 0 1.5rem

		.m3-button__icon > :global(svg)
			width: 1.25rem /* 20px */
			height: 1.25rem

	&--medium
		height: 3.5rem /* 56px */
		padding: 0 2rem

		.m3-button__icon > :global(svg)
			width: 1.5rem /* 24px */
			height: 1.5rem

	&--large
		height: 6rem /* 96px */
		padding: 0 2rem

		.m3-button__icon > :global(svg)
			width: 2rem /* 32px */
			height: 2rem

	&--xlarge
		height: 8.5rem /* 136px */
		padding: 0 2.5rem

		.m3-button__icon > :global(svg)
			width: 2.5rem /* 40px */
			height: 2.5rem

	/* === 变体（v0.192 tokens） === */
	&--filled
		background: var(--primary)
		color: var(--on-primary)
		--m3e-state-color: var(--on-primary)
		--m3-button-elevation: var(--m3e-elevation-0)

		&:hover
			--m3-button-elevation: var(--m3e-elevation-1) /* hover-container-elevation level1 */

		&.m3-button--disabled
			/* 覆盖全局 .m3-state-layer[disabled] 0.38：容器 12%、文字/图标 38% 分开控制 */
			opacity: 1
			background: unquote("color-mix(in srgb, var(--on-surface) 12%, transparent)")
			color: var(--on-surface)

			.m3-button__icon > :global(svg)
				opacity: 0.38

			.m3-button__label
				opacity: 0.38

	&--elevated
		background: var(--surface-container-low)
		color: var(--primary)
		--m3e-state-color: var(--primary)
		--m3-button-elevation: var(--m3e-elevation-1)

		&:hover
			--m3-button-elevation: var(--m3e-elevation-2) /* hover-container-elevation level2 */

		&.m3-button--disabled
			opacity: 1
			background: unquote("color-mix(in srgb, var(--on-surface) 12%, transparent)")
			color: var(--on-surface)
			box-shadow: none

			.m3-button__icon > :global(svg)
				opacity: 0.38

			.m3-button__label
				opacity: 0.38

	&--tonal
		background: var(--secondary-container)
		color: var(--on-secondary-container)
		--m3e-state-color: var(--on-secondary-container)
		--m3-button-elevation: var(--m3e-elevation-0)

		&:hover
			--m3-button-elevation: var(--m3e-elevation-1) /* hover-container-elevation level1 */

		&.m3-button--disabled
			opacity: 1
			background: unquote("color-mix(in srgb, var(--on-surface) 12%, transparent)")
			color: var(--on-surface)

			.m3-button__icon > :global(svg)
				opacity: 0.38

			.m3-button__label
				opacity: 0.38

	&--outlined
		border: 1px solid var(--outline)
		color: var(--primary)
		--m3e-state-color: var(--primary)

		&:hover
			border-color: var(--outline)

		&.m3-button--disabled
			opacity: 1
			border-color: unquote("color-mix(in srgb, var(--on-surface) 12%, transparent)")
			color: var(--on-surface)

			.m3-button__icon > :global(svg)
				opacity: 0.38

			.m3-button__label
				opacity: 0.38

	&--text
		color: var(--primary)
		--m3e-state-color: var(--primary)

		&.m3-button--disabled
			opacity: 1
			color: var(--on-surface)

			.m3-button__icon > :global(svg)
				opacity: 0.38

			.m3-button__label
				opacity: 0.38
</style>
