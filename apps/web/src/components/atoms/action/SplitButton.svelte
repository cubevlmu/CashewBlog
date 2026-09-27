<script lang="ts">
/**
 * M3E SplitButton — 分离式按钮原子（M3 Expressive 2025）。
 * leading 主操作 + trailing 菜单按钮，移植自 Compose Material3 SplitButton。
 * 尺寸五档（xs/s/m/l/xl）、变体（filled/tonal/outlined/elevated）；
 * 两段相接内角在 hover/pressed 时变形更圆（官方 InnerPressedCornerCornerSize），
 * trailing 激活（menuOpen）时箭头 180° 旋转。
 * 菜单弹层由调用方组合（本原子不 import 组件，符合原子规范）。
 *
 * 用法：
 *   <SplitButton bind:menuOpen={open} onclick={mainAction} size="m" variant="filled">
 *     主操作
 *   </SplitButton>
 *   <Menu bind:open={open} class="absolute top-11 right-0">…</Menu>
 */
import Icon from "@iconify/svelte";

let {
	variant = "filled",
	size = "s",
	menuOpen = $bindable(false),
	disabled = false,
	onclick = () => {},
	trailingLabel = "更多操作",
	class: className = "",
}: {
	variant?: "filled" | "tonal" | "outlined" | "elevated";
	size?: "xs" | "s" | "m" | "l" | "xl";
	menuOpen?: boolean;
	disabled?: boolean;
	onclick?: () => void;
	trailingLabel?: string;
	class?: string;
} = $props();
</script>

<div
    class="m3-split-button m3-split-button--{variant} m3-split-button--{size} {className}"
    class:m3-split-button--open={menuOpen}
>
    <button
        type="button"
        class="m3-split-button__leading m3-state-layer"
        onclick={onclick}
        {disabled}
    >
        <span class="m3-split-button__content"><slot /></span>
    </button>
    <button
        type="button"
        class="m3-split-button__trailing m3-state-layer"
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        aria-label={trailingLabel}
        {disabled}
        onclick={() => (menuOpen = !menuOpen)}
    >
        <span class="m3-split-button__trailing-icon">
            <slot name="trailing">
                <Icon icon="material-symbols:arrow-drop-down"></Icon>
            </slot>
        </span>
    </button>
</div>

<style lang="stylus">
.m3-split-button
    display: inline-flex
    gap: 2px
    user-select: none
    border-radius: var(--shape-corner-full)
    background: var(--primary)
    color: var(--on-primary)
    --m3e-state-color: var(--on-primary)

    &__leading, &__trailing
        display: inline-flex
        align-items: center
        justify-content: center
        border: none
        cursor: pointer
        white-space: nowrap
        background: transparent
        transition: border-radius var(--m3e-duration-short) var(--m3e-easing-emphasized-decelerate), box-shadow var(--m3e-duration-short) var(--m3e-easing-standard)

    &__leading
        height: var(--split-height)
        padding: 0 var(--split-leading-right) 0 var(--split-leading-left)
        border-radius: var(--shape-corner-full) var(--split-inner-corner) var(--split-inner-corner) var(--shape-corner-full)
        font: var(--m3e-type-label-large)

    &__trailing
        height: var(--split-height)
        padding: 0 var(--split-trailing-space)
        border-radius: var(--split-inner-corner) var(--shape-corner-full) var(--shape-corner-full) var(--split-inner-corner)

    &__content
        display: flex
        align-items: center
        gap: 0.5rem
        min-width: 0

    &__trailing-icon
        display: flex
        align-items: center
        justify-content: center
        font-size: var(--split-trailing-icon)
        transition: transform var(--m3e-duration-medium) var(--m3e-easing-emphasized-decelerate)
        > :global(svg)
            width: 1em
            height: 1em

    /* trailing 激活时箭头旋转 180° */
    &--open &__trailing-icon
        transform: rotate(180deg)

    /* 内角形状变形：hover/pressed 时相接处更圆（M3E 核心动效） */
    &__leading:hover, &__leading:active,
    &__trailing:hover, &__trailing:active
        --split-inner-corner: var(--split-inner-corner-hover)

    /* === 五档尺寸（官方 SplitButton*Tokens） === */
    &--xs
        --split-height: 2rem
        --split-leading-left: 0.75rem
        --split-leading-right: 0.625rem
        --split-trailing-space: 0.8125rem
        --split-trailing-icon: 1.375rem
        --split-inner-corner: 4px
        --split-inner-corner-hover: 8px
    &--s
        --split-height: 2.5rem
        --split-leading-left: 1rem
        --split-leading-right: 0.75rem
        --split-trailing-space: 0.8125rem
        --split-trailing-icon: 1.375rem
        --split-inner-corner: 4px
        --split-inner-corner-hover: 12px
    &--m
        --split-height: 3.5rem
        --split-leading-left: 1.5rem
        --split-leading-right: 1.5rem
        --split-trailing-space: 0.9375rem
        --split-trailing-icon: 1.625rem
        --split-inner-corner: 4px
        --split-inner-corner-hover: 12px
    &--l
        --split-height: 6rem
        --split-leading-left: 3rem
        --split-leading-right: 3rem
        --split-trailing-space: 1.8125rem
        --split-trailing-icon: 2.375rem
        --split-inner-corner: 8px
        --split-inner-corner-hover: 20px
    &--xl
        --split-height: 8.5rem
        --split-leading-left: 4rem
        --split-leading-right: 4rem
        --split-trailing-space: 2.6875rem
        --split-trailing-icon: 3.125rem
        --split-inner-corner: 12px
        --split-inner-corner-hover: 20px

    /* === 变体（容器着色，段透明，gap 处同色） === */
    &--tonal
        background: var(--secondary-container)
        color: var(--on-secondary-container)
        --m3e-state-color: var(--on-secondary-container)
        box-shadow: var(--m3e-elevation-1)

    &--elevated
        background: var(--secondary-container)
        color: var(--on-secondary-container)
        --m3e-state-color: var(--on-secondary-container)
        box-shadow: var(--m3e-elevation-1)
        &:hover
            box-shadow: var(--m3e-elevation-2)

    &--outlined
        background: transparent
        color: var(--primary)
        --m3e-state-color: var(--primary)
        box-shadow: none
        .m3-split-button__leading, .m3-split-button__trailing
            border: 1px solid var(--outline)
            background: transparent

    /* disabled：两段整体禁用 */
    &:has(button:disabled)
        opacity: 0.38
        pointer-events: none
</style>
