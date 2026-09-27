<script lang="ts">
/**
 * M3E NavigationBar — 底部导航原子（官方 NavigationBar.kt 移植）。
 * 64dp 高容器（surface-container + elevation-2），项均分。
 * Item：官方标准小指示器 pill（64×32 只包图标，secondary-container 全圆），
 * 选中时 scaleX 0→1 生长动画（官方 animateFloatAsState indicatorWidth）；
 * icon 与 label 间距 8px，pill 与文字不互相接触。
 * 用法：<NavigationBar items={[{value,label,icon}]} bind:value={tab} />
 */
import Icon from "@iconify/svelte";

let {
	items = [],
	value = $bindable(""),
	label = "导航",
	class: className = "",
}: {
	items: { value: string; label: string; icon?: string }[];
	value?: string;
	label?: string;
	class?: string;
} = $props();
</script>

<div class="m3-nav-bar {className}" role="navigation" aria-label={label}>
    {#each items as item (item.value)}
        <button
            type="button"
            class="m3-nav-bar__item"
            class:m3-nav-bar__item--active={value === item.value}
            aria-current={value === item.value ? "page" : undefined}
            onclick={() => (value = item.value)}
        >
            <span class="m3-nav-bar__indicator" aria-hidden="true"></span>
            <span class="m3-nav-bar__icon" aria-hidden="true">
                <Icon icon={item.icon ?? "material-symbols:circle"}></Icon>
            </span>
            <span class="m3-nav-bar__label">{item.label}</span>
        </button>
    {/each}
</div>

<style lang="stylus">
.m3-nav-bar
    display: flex
    height: 4rem
    background: var(--surface-container)
    box-shadow: var(--m3e-elevation-2)
    border-radius: var(--shape-corner-l)

    &__item
        position: relative
        flex: 1
        display: flex
        flex-direction: column
        align-items: center
        justify-content: center
        gap: 0.5rem
        border: none
        background: none
        cursor: pointer
        &:focus-visible
            outline: 2px solid var(--secondary)
            outline-offset: -2px

    /* 指示器 pill（官方 ItemActiveIndicator 64×32 全圆，只包图标）：
       active 时 scaleX 0→1 生长（官方 animateFloatAsState indicatorWidth）；
       top 4px 定位使 pill 底 36 与 label 顶 40 留 4px 间距，不互相接触 */
    &__indicator
        position: absolute
        top: 0.25rem
        left: 50%
        transform: translateX(-50%) scaleX(0)
        width: 4rem
        height: 2rem
        border-radius: var(--shape-corner-full)
        background: var(--secondary-container)
        transition: transform var(--m3e-duration-medium) var(--m3e-easing-emphasized-decelerate)

    &__item--active &__indicator
        transform: translateX(-50%) scaleX(1)

    &__icon
        position: relative
        display: flex
        color: var(--on-surface-variant)
        transition: color var(--m3e-duration-short) var(--m3e-easing-standard)
        > :global(svg)
            width: 1.5rem
            height: 1.5rem

    &__item--active &__icon
        color: var(--on-secondary-container)

    &__label
        position: relative
        font: var(--m3e-type-label-medium)
        color: var(--on-surface-variant)
        white-space: nowrap
        transition: color var(--m3e-duration-short) var(--m3e-easing-standard)

    &__item--active &__label
        color: var(--secondary)
</style>
