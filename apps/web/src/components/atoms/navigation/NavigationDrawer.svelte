<script lang="ts">
/**
 * M3E NavigationDrawer — 模态导航抽屉原子（官方 ModalNavigationDrawer 移植）。
 * 遮罩（scrim）+ 左侧滑出面板（360dp，官方 ModalNavigationDrawerTokens.ContainerWidth，
 * 背景 surface-container-low，右侧大圆角），面板内 header 插槽 + 数据驱动 items。
 * Item（官方 NavigationDrawerItem）：全宽 56dp 高，selected 时整项变
 * secondary-container 全圆 pill（官方 ActiveIndicatorShape CornerFull）+ label-large
 * on-secondary-container，leading 图标 on-secondary-container；未选中 on-surface-variant。
 * 动画：面板 translateX(-100%)→0（emphasized-decelerate 350ms）+ 遮罩淡入；
 * Esc / 遮罩点击关闭。始终渲染（CSS class 控制显隐，过渡干净）。
 *
 * 用法：<NavigationDrawer items={[{value,label,icon}]} bind:open={open} />
 */
import Icon from "@iconify/svelte";
import { onMount, tick } from "svelte";

let {
	items = [],
	open = $bindable(false),
	value = $bindable(""),
	label = "导航",
	header,
	footer,
	class: className = "",
}: {
	items: { value: string; label: string; icon?: string }[];
	/** 抽屉开合（$bindable），Esc/遮罩点击自动置 false */
	open?: boolean;
	/** 选中项 value（$bindable） */
	value?: string;
	label?: string;
	/** 面板顶部插槽（标题/Logo 等） */
	header?: import("svelte").Snippet;
	/** 面板底部插槽（设置/退出等） */
	footer?: import("svelte").Snippet;
	class?: string;
} = $props();

let drawerEl: HTMLElement | undefined = $state();

function onOverlayClick() {
	open = false;
}

// 打开时键盘焦点移到抽屉首个可聚焦项（官方 ModalNavigationDrawer 行为）
$effect(() => {
	if (open) {
		tick().then(() => {
			drawerEl?.querySelector<HTMLElement>(".m3-drawer__item")?.focus();
		});
	}
});

// Esc 关闭
onMount(() => {
	function onKey(e: KeyboardEvent) {
		if (e.key === "Escape") {
			open = false;
		}
	}
	window.addEventListener("keydown", onKey);
	return () => window.removeEventListener("keydown", onKey);
});
</script>

<div
    class="m3-drawer-root {className}"
    class:m3-drawer-root--open={open}
>
    <div class="m3-drawer__scrim" onclick={onOverlayClick} aria-hidden="true"></div>
    <aside bind:this={drawerEl} class="m3-drawer" role="dialog" aria-modal="true" aria-label={label}>
        <div class="m3-drawer__head">{@render header?.()}</div>
        <div class="m3-drawer__items">
            {#each items as item (item.value)}
                <button
                    type="button"
                    class="m3-drawer__item"
                    class:m3-drawer__item--active={value === item.value}
                    aria-current={value === item.value ? "page" : undefined}
                    onclick={() => (value = item.value)}
                >
                    <span class="m3-drawer__icon" aria-hidden="true">
                        <Icon icon={item.icon ?? "material-symbols:circle"}></Icon>
                    </span>
                    <span class="m3-drawer__label">{item.label}</span>
                </button>
            {/each}
        </div>
        <div class="m3-drawer__foot">{@render footer?.()}</div>
    </aside>
</div>

<style lang="stylus">
.m3-drawer-root
    position: fixed
    inset: 0
    z-index: 60
    visibility: hidden
    pointer-events: none

    &.m3-drawer-root--open
        visibility: visible
        pointer-events: auto

    .m3-drawer__scrim
        position: absolute
        inset: 0
        background: unquote("color-mix(in oklab, var(--scrim, #000) 32%, transparent)")
        opacity: 0
        transition: opacity var(--m3e-duration-medium) var(--m3e-easing-standard)

    &.m3-drawer-root--open .m3-drawer__scrim
        opacity: 1

    /* 面板：360dp 宽（官方 ModalNavigationDrawerTokens.ContainerWidth），
       surface-container-low，右侧 16dp 圆角（官方 ShapeCornerLargeEnd）；
       从左侧滑入 */
    .m3-drawer
        position: absolute
        top: 0
        bottom: 0
        left: 0
        display: flex
        flex-direction: column
        width: 360px
        max-width: 85vw
        box-sizing: border-box
        background: var(--surface-container-low)
        color: var(--on-surface)
        border-radius: 0 var(--shape-corner-l) var(--shape-corner-l) 0
        transform: translateX(-100%)
        transition: transform var(--m3e-duration-long) var(--m3e-easing-emphasized-decelerate)

    &.m3-drawer-root--open .m3-drawer
        transform: translateX(0)

    .m3-drawer__head
        padding: 16px 28px 8px

    .m3-drawer__items
        flex: 1
        overflow-y: auto
        padding: 8px 12px

    .m3-drawer__foot
        padding: 8px 12px 16px

    /* Item：全宽 56dp 高，selected 整项变 secondary-container 全圆 pill */
    .m3-drawer__item
        display: flex
        align-items: center
        gap: 12px
        width: 100%
        height: 56px
        box-sizing: border-box
        padding: 0 16px
        border: none
        border-radius: var(--shape-corner-full)
        background: none
        color: var(--on-surface-variant)
        cursor: pointer
        transition:
            background-color var(--m3e-duration-short) var(--m3e-easing-standard),
            color var(--m3e-duration-short) var(--m3e-easing-standard)
        &:hover
            background: unquote("color-mix(in oklab, var(--on-surface) 8%, transparent)")
        &:focus-visible
            outline: 2px solid var(--secondary)
            outline-offset: -2px

    .m3-drawer__item--active
        background: var(--secondary-container)
        color: var(--on-secondary-container)
        &:hover
            background: var(--secondary-container)

    .m3-drawer__icon
        display: flex
        flex: none
        > :global(svg)
            width: 1.5rem
            height: 1.5rem

    .m3-drawer__label
        font: var(--m3e-type-label-large)
        white-space: nowrap
        overflow: hidden
        text-overflow: ellipsis
</style>
