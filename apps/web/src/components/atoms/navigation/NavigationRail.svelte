<script lang="ts">
/**
 * M3E NavigationRail — 侧边导航栏原子（官方 NavigationRail.kt 移植）。
 * 80dp 宽容器（官方 NavigationRailCollapsedTokens.NarrowContainerWidth，
 * 背景 surface），垂直排列 items + 可选 header 插槽。
 * Item：56×32 指示器 pill（官方 BaselineItemTokens.ActiveIndicatorWidth/Height，
 * secondary-container 全圆，只包图标），选中 scaleX 0→1 生长动画；
 * icon 24px + label（label-medium）gap 4dp（官方 VerticalItemTokens）。
 *
 * 用法：<NavigationRail items={[{value,label,icon}]} bind:value={tab} />
 *      <NavigationRail items={items} bind:value={tab}>
 *          {#snippet header()}<头像/Logo>{/snippet}
 *      </NavigationRail>
 */
import Icon from "@iconify/svelte";

let {
	items = [],
	value = $bindable(""),
	label = "导航",
	alwaysShowLabel = true,
	header,
	class: className = "",
}: {
	items: { value: string; label: string; icon?: string }[];
	value?: string;
	label?: string;
	/** false = 折叠模式（官方 alwaysShowLabel）：仅选中项显示 label，其余只图标 */
	alwaysShowLabel?: boolean;
	/** header 插槽（顶部，通常 FAB/头像/Logo） */
	header?: import("svelte").Snippet;
	class?: string;
} = $props();
</script>

<div class="m3-nav-rail {className}" role="navigation" aria-label={label}>
    {#if header}
        <div class="m3-nav-rail__header">{@render header()}</div>
    {/if}
    <div class="m3-nav-rail__items">
        {#each items as item (item.value)}
            <button
                type="button"
                class="m3-nav-rail__item"
                class:m3-nav-rail__item--active={value === item.value}
                class:m3-nav-rail__item--collapsed={!alwaysShowLabel}
                aria-label={item.label}
                aria-current={value === item.value ? "page" : undefined}
                onclick={() => (value = item.value)}
            >
                <span class="m3-nav-rail__indicator" aria-hidden="true"></span>
                <span class="m3-nav-rail__icon" aria-hidden="true">
                    <Icon icon={item.icon ?? "material-symbols:circle"}></Icon>
                </span>
                <span class="m3-nav-rail__label">{item.label}</span>
            </button>
        {/each}
    </div>
</div>

<style lang="stylus">
.m3-nav-rail
    display: flex
    flex-direction: column
    align-items: center
    gap: 12px
    width: 80px
    min-height: 100%
    box-sizing: border-box
    padding: 12px 0
    background: var(--surface)
    color: var(--on-surface)

    &__header
        display: flex
        flex-direction: column
        align-items: center

    &__items
        display: flex
        flex-direction: column
        gap: 12px

    /* item：64dp 高（官方 BaselineItemTokens ContainerHeight 64），
       grid 两行：第 1 行 32px（indicator 背景 pill 与 icon 前景叠放，中心对齐），
       第 2 行 label（距 pill 8px，官方 ActiveIndicatorIconLabelSpace）。
       icon 独立于 pill 的 opacity，始终可见（官方 indicator alpha 只影响背景） */
    &__item
        display: grid
        grid-template-rows: 32px auto
        justify-items: center
        align-content: center
        width: 72px
        height: 64px
        box-sizing: border-box
        border: none
        border-radius: var(--shape-corner-full)
        background: none
        cursor: pointer
        &:focus-visible
            outline: 2px solid var(--secondary)
            outline-offset: -2px

    /* 指示器 pill（官方 BaselineItemTokens ActiveIndicatorWidth 56/Height 32 全圆，
       背景层）：active 时 alpha 0→1 + scaleX 0→1 生长
       （官方 DefaultEffects alpha + FastSpatial width）；
       hover 未选中显示 on-surface 8% 灰色 ripple 圆，选中 hover 叠加色 */
    &__indicator
        grid-row: 1
        grid-column: 1
        width: 56px
        height: 32px
        border-radius: var(--shape-corner-full)
        background: unquote("color-mix(in oklab, var(--on-surface) 8%, transparent)")
        opacity: 0
        transform: scaleX(0)
        transition:
            transform var(--m3e-duration-medium) var(--m3e-easing-emphasized-decelerate),
            opacity var(--m3e-duration-medium) var(--m3e-easing-standard),
            background-color var(--m3e-duration-short) var(--m3e-easing-standard)

    &__item:hover &__indicator
        transform: scaleX(1)
        opacity: 1

    &__item--active &__indicator
        transform: scaleX(1)
        opacity: 1
        background: var(--secondary-container)

    &__item--active:hover &__indicator
        background: unquote("color-mix(in oklab, var(--on-secondary-container) 8%, var(--secondary-container))")

    /* icon 前景层：与 pill 同 grid cell（第 1 行居中），始终可见；
       z-index 1 确保在带 transform 的 pill 之上（transform 会创建 stacking context） */
    &__icon
        grid-row: 1
        grid-column: 1
        align-self: center
        z-index: 1
        display: flex
        color: var(--on-surface-variant)
        transition: color var(--m3e-duration-short) var(--m3e-easing-standard)
        > :global(svg)
            width: 1.5rem
            height: 1.5rem

    &__item--active &__icon
        color: var(--on-secondary-container)

    &__label
        grid-row: 2
        margin-top: 8px
        font: var(--m3e-type-label-medium)
        color: var(--on-surface-variant)
        white-space: nowrap
        transition: color var(--m3e-duration-short) var(--m3e-easing-standard)

    &__item--active &__label
        color: var(--secondary)

    /* 折叠模式（alwaysShowLabel=false，官方 CollapsedTokens）：
       仅选中项显示 label，其余只图标（item min 56、icon 居中） */
    &__item--collapsed
        min-height: 56px
        grid-template-rows: 32px auto

        &:not(.m3-nav-rail__item--active)
            .m3-nav-rail__label
                display: none
</style>
