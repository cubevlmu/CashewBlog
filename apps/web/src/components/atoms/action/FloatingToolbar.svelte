<script lang="ts">
/**
 * M3E FloatingToolbar — 浮动工具栏原子（官方 FloatingToolbar.kt 移植）。
 * 选中文本时的浮动操作条：CornerFull pill 容器，展开（expanded）时显示完整
 * content（图标按钮组），收起（collapsed）时折叠成单个小圆按钮（只显示
 * leadingContent / 第一个图标）。
 * 容器色 primary-container（官方 FloatingToolbarTokens，OnPrimaryContainer 内容），
 * 展开/收起有阴影差（官方 ContainerExpanded/CollapsedElevation）。
 * 简化实现：不做滚动隐藏（scrollBehavior 留待后续）。
 *
 * 用法：<FloatingToolbar bind:expanded={expanded}>
 *          {#snippet content()}<IconButton/><IconButton/>{/snippet}
 *       </FloatingToolbar>
 */
let {
	expanded = $bindable(true),
	leading,
	trailing,
	containerColor,
	label = "",
	expandLabel = "",
	class: className = "",
	children,
}: {
	/** 展开状态（$bindable）：展开 = 完整条，收起 = 折叠成小圆按钮 */
	expanded?: boolean;
	/** 收起时显示的内容（折叠按钮） */
	leading?: import("svelte").Snippet;
	/** 展开时尾部内容 */
	trailing?: import("svelte").Snippet;
	/** 容器色覆盖（默认 primary-container） */
	containerColor?: string;
	/** 工具栏的无障碍名称 */
	label?: string;
	/** 收起状态切换按钮的无障碍名称 */
	expandLabel?: string;
	class?: string;
	children?: import("svelte").Snippet;
} = $props();
</script>

<div
    class="m3-toolbar {className}"
    class:m3-toolbar--expanded={expanded}
    class:m3-toolbar--collapsed={!expanded}
    style={containerColor ? `--m3-toolbar-bg: ${containerColor}` : undefined}
    role="toolbar"
    aria-label={label || undefined}
>
    {#if !expanded}
        <button
            class="m3-toolbar__toggle"
            aria-label={expandLabel || label || undefined}
            onclick={() => (expanded = true)}
        >
            {@render leading?.()}
        </button>
    {:else}
        <div class="m3-toolbar__leading">{@render leading?.()}</div>
        <div class="m3-toolbar__content">{@render children?.()}</div>
        <div class="m3-toolbar__trailing">{@render trailing?.()}</div>
    {/if}
</div>

<style lang="stylus">
.m3-toolbar
    --m3-toolbar-bg: var(--primary-container)
    display: inline-flex
    align-items: center
    box-sizing: border-box
    border-radius: var(--shape-corner-full)
    background: var(--m3-toolbar-bg)
    color: var(--on-primary-container)
    transition:
        box-shadow var(--m3e-duration-medium) var(--m3e-easing-emphasized-decelerate),
        padding var(--m3e-duration-medium) var(--m3e-easing-emphasized-decelerate)

    &--collapsed
        padding: 4px
        box-shadow: var(--m3e-elevation-1)
        cursor: pointer

    &--expanded
        gap: 4px
        padding: 8px 4px
        box-shadow: var(--m3e-elevation-2)

    &__toggle
        display: flex
        align-items: center
        justify-content: center
        width: 40px
        height: 40px
        padding: 0
        border: none
        border-radius: var(--shape-corner-full)
        background: none
        color: var(--on-primary-container)
        cursor: pointer
        &:hover
            background: unquote("color-mix(in oklab, var(--on-primary-container) 8%, transparent)")
        &:focus-visible
            outline: 2px solid var(--on-primary-container)
            outline-offset: -2px
        > :global(svg)
            width: 1.5rem
            height: 1.5rem

    &__leading, &__trailing
        display: flex
        align-items: center

    &__content
        display: flex
        align-items: center
        gap: 4px
</style>
