<script lang="ts">
/**
 * M3E Badge — M3 徽标原子（移植自 Compose Material3 Badge）。
 * 无内容时为 6px 圆点；有内容时显示 label-small 文字（min 16px，error 底）。
 * 用法：<Badge />                （红点）
 *      <Badge content="3" />     （数字徽标）
 * 需锚定到图标时用 <BadgedBox> 包裹。
 */
let {
	content = "",
	disabled = false,
	children,
}: {
	content?: string;
	disabled?: boolean;
	children?: import("svelte").Snippet;
} = $props();
</script>

<span class="m3-badge" class:m3-badge--dot={!content && !children} class:disabled={disabled}>
    <span class="m3-badge__label" class:show={!!content || !!children}>
        {#if children}
            {@render children()}
        {:else}
            {content}
        {/if}
    </span>
</span>

<style lang="stylus">
.m3-badge
    display: inline-flex
    align-items: center
    justify-content: center
    min-width: 1rem
    height: 1rem
    border-radius: var(--shape-corner-full)
    background: var(--error)
    color: var(--on-error)
    padding: 0 0.25rem
    font: var(--m3e-type-label-small)
    box-sizing: border-box
    /* dot ↔ 数字切换：尺寸/间距过渡 */
    transition:
        width var(--m3e-duration-short) var(--m3e-easing-standard),
        min-width var(--m3e-duration-short) var(--m3e-easing-standard),
        height var(--m3e-duration-short) var(--m3e-easing-standard),
        padding var(--m3e-duration-short) var(--m3e-easing-standard)

    /* 无内容：6px 红点 */
    &--dot
        width: 0.375rem
        height: 0.375rem
        min-width: 0.375rem
        padding: 0

    &.disabled
        opacity: 0.38

    /* 数字 label：恒渲染 + show 驱动 scale/fade（避免 {#if} 插入无动画） */
    &__label
        transform: scale(0)
        opacity: 0
        transition:
            transform var(--m3e-duration-medium) var(--m3e-easing-emphasized-decelerate),
            opacity var(--m3e-duration-short) var(--m3e-easing-standard)

        &.show
            transform: scale(1)
            opacity: 1
</style>
