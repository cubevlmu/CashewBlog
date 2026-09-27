<script lang="ts">
/**
 * M3E ToggleButton — 切换按钮原子（官方 ToggleButton.kt 移植）。
 * 原生 button + aria-pressed，点击切换 checked。
 *
 * 变体（官方 ButtonTokens 选中/未选中色）：
 * - filled：选中 primary/on-primary，未选中 surface-container/on-surface-variant
 * - tonal：选中 secondary/on-secondary，未选中 secondary-container/on-secondary-container
 * - outlined：选中 inverse-surface/inverse-on-surface，未选中透明 + outline 1px 描边
 * - elevated：选中 primary/on-primary，未选中 surface-container-low/primary + elevation-1
 *
 * 形状变形（官方 ToggleButtonShapes）：未选中 pill（CornerFull）→ 按压 6dp → 选中 12dp。
 * 40dp 高、图标 20dp、padding 16dp、label-large。
 */
let {
	checked = $bindable(false),
	variant = "filled",
	disabled = false,
	label = "",
	ariaLabel = "",
	controlled = false,
	class: className = "",
	style = "",
	onclick,
	onpointerdown,
}: {
	checked?: boolean;
	variant?: "filled" | "tonal" | "outlined" | "elevated";
	disabled?: boolean;
	label?: string;
	/** 无障碍名称（图标按钮无可见文本时使用） */
	ariaLabel?: string;
	/** 受控模式：点击不自动切换 checked，仅触发 onclick 回调（由父级管理状态） */
	controlled?: boolean;
	class?: string;
	style?: string;
	onclick?: () => void;
	onpointerdown?: (e: PointerEvent) => void;
} = $props();

function handleClick() {
	if (controlled) onclick?.();
	else checked = !checked;
}
</script>

<button
    type="button"
    class="m3-toggle-button m3-toggle-button--{variant} m3-state-layer {className}"
    class:m3-toggle-button--checked={checked}
    class:m3-toggle-button--disabled={disabled}
    {style}
    aria-label={ariaLabel || undefined}
    aria-pressed={checked}
    disabled={disabled}
    onclick={handleClick}
    onpointerdown={onpointerdown}
>
    <slot />
    {#if label}
        <span class="m3-toggle-button__label">{label}</span>
    {/if}
</button>

<style lang="stylus">
.m3-toggle-button
    display: inline-flex
    align-items: center
    justify-content: center
    gap: 0.5rem
    min-height: 2.5rem
    padding: 0 1rem
    border: none
    border-radius: var(--tb-corner, var(--shape-corner-full))
    font: var(--m3e-type-label-large)
    cursor: pointer
    user-select: none
    --tb-corner: var(--shape-corner-full)
    transition:
        border-radius var(--m3e-duration-medium) var(--m3e-easing-emphasized-decelerate),
        background-color var(--m3e-duration-medium) var(--m3e-easing-standard),
        color var(--m3e-duration-medium) var(--m3e-easing-standard),
        border-color var(--m3e-duration-medium) var(--m3e-easing-standard),
        box-shadow var(--m3e-duration-medium) var(--m3e-easing-standard)
    > :global(svg)
        width: 1.25rem
        height: 1.25rem
        flex-shrink: 0

    /* 形状变形：按压 6dp（未选中时）；选中态 12dp（优先级高于按压） */
    &:active
        --tb-corner: 6px

    &--checked
        --tb-corner: var(--shape-corner-m)

    &--disabled
        opacity: 0.38
        pointer-events: none

    /* === 变体颜色 === */
    &--filled
        background: var(--surface-container)
        color: var(--on-surface-variant)
        --m3e-state-color: var(--on-surface-variant)
        &.m3-toggle-button--checked
            background: var(--primary)
            color: var(--on-primary)
            --m3e-state-color: var(--on-primary)

    &--tonal
        background: var(--secondary-container)
        color: var(--on-secondary-container)
        --m3e-state-color: var(--on-secondary-container)
        &.m3-toggle-button--checked
            background: var(--secondary)
            color: var(--on-secondary)
            --m3e-state-color: var(--on-secondary)

    &--outlined
        background: transparent
        color: var(--on-surface-variant)
        border: 1px solid var(--outline)
        --m3e-state-color: var(--on-surface-variant)
        &.m3-toggle-button--checked
            background: var(--inverse-surface)
            color: var(--inverse-on-surface)
            border-color: transparent
            --m3e-state-color: var(--inverse-on-surface)

    &--elevated
        background: var(--surface-container-low)
        color: var(--primary)
        box-shadow: var(--m3e-elevation-1)
        --m3e-state-color: var(--primary)
        &.m3-toggle-button--checked
            background: var(--primary)
            color: var(--on-primary)
            box-shadow: var(--m3e-elevation-1)
            --m3e-state-color: var(--on-primary)
</style>
