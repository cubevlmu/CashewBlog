<script lang="ts">
/**
 * M3E AppBar — 顶部应用栏（官方 AppBar.kt / AppBar*Tokens 移植）。
 * variant: small（64dp，标题 title-large）、
 *          center（同 small 但标题相对整栏水平居中）、
 *          medium（112dp，标题 headline-small 大字靠下）、
 *          large（152dp，标题 headline-medium 大字靠下）。
 * 背景 surface、标题 on-surface、图标 on-surface-variant（官方 token）。
 * 布局：small/center 单行 [nav][title][actions]（水平 padding 4dp，官方
 *       TopAppBarHorizontalPadding；无导航图标时标题 16dp inset，
 *       有导航图标时紧跟 48dp 图标）；medium/large 两行：顶部 64dp 工具行
 *       [nav][actions] + 底部大字标题（官方 TwoRowsTopAppBar，标题基线距底
 *       24dp/28dp；静态版不做滚动折叠，scrollBehavior 留待后续）。
 * 用法：<AppBar title="标题" navigationIcon={...snippet} actions={...snippet} />
 *      <AppBar variant="medium" title="文章" />
 */
let {
	variant = "small",
	title,
	navigationIcon,
	actions,
	class: className = "",
}: {
	/** small（默认）/ center / medium / large */
	variant?: "small" | "center" | "medium" | "large";
	/** 标题（string 或 snippet） */
	title?: string | import("svelte").Snippet;
	/** 导航图标插槽（通常为 IconButton），显示在起始端 */
	navigationIcon?: import("svelte").Snippet;
	/** 操作区插槽（通常为 IconButton 组），显示在末尾端 */
	actions?: import("svelte").Snippet;
	class?: string;
} = $props();
</script>

<header
    class="m3-appbar m3-appbar--{variant} {className}"
    class:m3-appbar--with-nav={!!navigationIcon}
>
    {#if variant === "medium" || variant === "large"}
        <div class="m3-appbar__top">
            <div class="m3-appbar__nav">{@render navigationIcon?.()}</div>
            <div class="m3-appbar__actions">{@render actions?.()}</div>
        </div>
        <div class="m3-appbar__title">
            {#if typeof title === "string"}{title}{:else}{@render title?.()}{/if}
        </div>
    {:else}
        <div class="m3-appbar__nav">{@render navigationIcon?.()}</div>
        <div class="m3-appbar__title">
            {#if typeof title === "string"}{title}{:else}{@render title?.()}{/if}
        </div>
        <div class="m3-appbar__actions">{@render actions?.()}</div>
    {/if}
</header>

<style lang="stylus">
.m3-appbar
    position: relative
    display: flex
    box-sizing: border-box
    width: 100%
    background: var(--surface)
    color: var(--on-surface)
    overflow: hidden

    /* 单行 small / center：64dp 高，水平 padding 4dp（官方 TopAppBarHorizontalPadding） */
    &--small, &--center
        height: 64px
        align-items: center
        padding: 0 4px

    /* center：标题相对整条栏居中（官方按整栏宽度居中，碰撞时再让位） */
    &--center
        justify-content: space-between
        & .m3-appbar__title
            position: absolute
            inset: 0
            display: flex
            align-items: center
            justify-content: center
            max-width: calc(100% - 104px)
            margin: 0 auto
            padding: 0 16px
            text-align: center
            pointer-events: none

    /* medium / large：两行布局，官方 112dp / 152dp */
    &--medium
        height: 112px
        flex-direction: column

    &--large
        height: 152px
        flex-direction: column

    &__top
        display: flex
        align-items: center
        flex: none
        height: 64px
        padding: 0 4px

    &__nav
        display: flex
        align-items: center
        flex: none
        color: var(--on-surface-variant)

    &__title
        flex: 1
        min-width: 0
        font: var(--m3e-type-title-large)
        color: var(--on-surface)
        white-space: nowrap
        overflow: hidden
        text-overflow: ellipsis
        padding: 0 4px

    /* 单行 small：无导航图标时标题 16dp inset；有导航图标时紧跟 48dp 图标 */
    &--small &__title
        padding-left: 12px

    &--small.m3-appbar--with-nav &__title
        padding-left: 4px

    /* medium / large：大字标题靠下（基线距底 24dp / 28dp，官方 token） */
    &--medium &__title
        font: var(--m3e-type-headline-small)
        display: flex
        align-items: flex-end
        padding: 0 16px 16px

    &--large &__title
        font: var(--m3e-type-headline-medium)
        display: flex
        align-items: flex-end
        padding: 0 16px 20px

    &__actions
        display: flex
        align-items: center
        flex: none
        margin-left: auto
        color: var(--on-surface-variant)
</style>
