<script lang="ts">
/**
 * M3E Card — 卡片原子（官方 Card.kt 移植）。
 * variant: filled（默认，官方 FilledCardTokens：surface-container-highest、无阴影）/
 *          elevated（ElevatedCardTokens：surface-container-low、阴影 Level1，hover Level2）/
 *          outlined（OutlinedCardTokens：surface、outline-variant 1px 边框，hover outline）。
 * 形状：corner-medium（12px，官方 ContainerShape）。
 * href 传入时渲染为原生 <a>（卡片链接，可点击）；onClick 传入时渲染为原生
 * button（clickable card，enabled 控制禁用）；两者都不传则渲染为普通容器 div。
 * href 优先于 onClick。
 *
 * 用法：<Card>内容</Card>
 *      <Card variant="elevated">内容</Card>
 *      <Card variant="outlined" onClick={...}>内容</Card>
 *      <Card href="/post/foo/">卡片链接</Card>
 *      <Card onClick={...} enabled={false}>禁用的卡片</Card>
 */
let {
	variant = "filled",
	onClick,
	href,
	target,
	enabled = true,
	color,
	radius = "",
	id = undefined,
	class: className = "",
	children,
}: {
	/** filled（默认）/ elevated / outlined */
	variant?: "filled" | "elevated" | "outlined";
	/** 传入则渲染为可点击卡片（button）；省略 = 普通容器 */
	onClick?: (e: MouseEvent) => void;
	/** 传入则渲染为卡片链接（<a>）；优先于 onClick */
	href?: string;
	/** 卡片链接的打开方式（target） */
	target?: string | null;
	/** 可点击卡片的可用状态（false 时禁用、视觉降级） */
	enabled?: boolean;
	/** 覆盖容器背景色（默认按变体） */
	color?: string;
	/** 圆角覆盖：不传跟随官方 corner-medium 12px；token 名 m/l/xl/full 或任意 CSS 长度 */
	radius?: string;
	/** 根元素 id 透传（供 CSS 选择器 / 锚点引用） */
	id?: string;
	class?: string;
	children?: import("svelte").Snippet;
} = $props();

/** 圆角 token 名 → 设计令牌；其他值按 CSS 原样传入 */
const RADIUS_TOKENS: Record<string, string> = {
	m: "var(--shape-corner-m)",
	l: "var(--shape-corner-l)",
	xl: "var(--shape-corner-xl)",
	full: "var(--shape-corner-full)",
};
const radiusVar = (r: string) => RADIUS_TOKENS[r] ?? r;
const styleVars = [
	color ? `--m3-card-bg: ${color}` : "",
	radius ? `--m3-card-radius: ${radiusVar(radius)}` : "",
]
	.filter(Boolean)
	.join("; ");
</script>

{#if href}
    <a
        id={id}
        href={href}
        target={target ?? undefined}
        class="m3-card m3-card--{variant} m3-card--interactive {className}"
        class:m3-card--disabled={!enabled}
        style={styleVars || undefined}
    >
        {@render children?.()}
    </a>
{:else if onClick}
    <button
        id={id}
        class="m3-card m3-card--{variant} m3-card--interactive {className}"
        class:m3-card--disabled={!enabled}
        onclick={onClick}
        disabled={!enabled}
        style={styleVars || undefined}
    >
        {@render children?.()}
    </button>
{:else}
    <div
        id={id}
        class="m3-card m3-card--{variant} {className}"
        style={styleVars || undefined}
    >
        {@render children?.()}
    </div>
{/if}

<style lang="stylus">
.m3-card
    --m3-card-bg: var(--surface-container-highest)
    display: block
    box-sizing: border-box
    border-radius: var(--m3-card-radius, var(--shape-corner-m))
    background: var(--m3-card-bg)
    color: var(--on-surface)
    /* 形状圆角跟随变体一致，内容溢出圆角裁剪 */
    overflow: hidden
    transition:
        box-shadow var(--m3e-duration-medium) var(--m3e-easing-emphasized-decelerate),
        border-color var(--m3e-duration-medium) var(--m3e-easing-emphasized-decelerate),
        background-color var(--m3e-duration-medium) var(--m3e-easing-emphasized-decelerate)

    /* 可点击卡片（button/a 语义）：hover/pressed 加 on-surface overlay + focus ring；
       button 默认 padding 由 Tailwind preflight 归零，外部 p-* 类可正常生效 */
    &--interactive
        appearance: none
        border: 0
        width: 100%
        text-align: inherit
        font: inherit
        cursor: pointer
        text-decoration: none
        color: inherit
        &:hover
            background: unquote("color-mix(in oklab, var(--on-surface) 4%, var(--m3-card-bg))")
        &:active
            background: unquote("color-mix(in oklab, var(--on-surface) 8%, var(--m3-card-bg))")
        &:focus-visible
            outline: 2px solid var(--primary)
            outline-offset: 2px

    &--elevated
        --m3-card-bg: var(--surface-container-low)
        box-shadow: var(--m3e-elevation-1)
        &:hover
            box-shadow: var(--m3e-elevation-2)

    &--outlined
        --m3-card-bg: var(--surface)
        border: 1px solid var(--outline-variant)
        &:hover
            border-color: var(--outline)

    &--disabled
        cursor: default
        opacity: 0.38
        pointer-events: none
</style>
