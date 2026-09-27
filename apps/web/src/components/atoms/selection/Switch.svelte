<script lang="ts">
/**
 * M3E Switch — M3/M3E 开关原子。
 * 原生 <input type="checkbox"> 提供无障碍与键盘支持，自绘 track/thumb。
 * icons（默认 false）：为 true 时启用 M3E 图标变体——thumb 恒 24px 并显示
 * 指示器（选中 ✓ / 未选中 ✕），与安卓 M3E Switch-with-icons 一致；
 * 缺省为经典样式（thumb 16↔24 动态放大，无图标）。
 * 用法：<Switch bind:checked={setting} label="Enable X" />
 *      <Switch bind:checked={setting} label="Enable X" icons />
 */
let {
	checked = $bindable(false),
	disabled = false,
	label = "",
	icons = false,
}: {
	checked?: boolean;
	disabled?: boolean;
	label?: string;
	icons?: boolean;
} = $props();
</script>

<label class="m3-switch" class:disabled={disabled} class:m3-switch--icons={icons}>
    <input
        type="checkbox"
        bind:checked
        {disabled}
        aria-label={label}
        class="m3-switch__input"
    />
    <span class="m3-switch__track m3-state-layer">
        <span class="m3-switch__thumb">
            {#if icons}
                <svg class="m3-switch__icon m3-switch__icon--check" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M9.55 18.308 4.632 13.39l1.415-1.414 3.503 3.503 8.403-8.403 1.414 1.415Z"></path>
                </svg>
                <svg class="m3-switch__icon m3-switch__icon--close" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M6.4 19 5 17.6l5.6-5.6L5 6.4 6.4 5l5.6 5.6L17.6 5 19 6.4l-5.6 5.6 5.6 5.6-1.4 1.4-5.6-5.6Z"></path>
                </svg>
            {/if}
        </span>
    </span>
</label>

<style lang="stylus">
.m3-switch
    display: inline-flex
    cursor: pointer
    -webkit-tap-highlight-color: transparent

    &.disabled
        opacity: 0.38
        pointer-events: none

    /* 隐藏原生 checkbox（保留可访问性） */
    &__input
        position: absolute
        width: 1px
        height: 1px
        opacity: 0
        overflow: hidden
        clip: rect(0 0 0 0)
        white-space: nowrap
        clip-path: inset(50%)

    /* checkbox 聚焦时给 track 描边（:focus-visible 无法直接作用于 label） */
    &__input:focus-visible ~ &__track
        outline: 2px solid var(--primary)
        outline-offset: 2px

    &__track
        position: relative
        width: 3.25rem
        height: 2rem
        border-radius: var(--shape-corner-full)
        border: 2px solid var(--outline)
        box-sizing: border-box
        background: var(--surface-container-highest)
        transition: background-color var(--m3e-duration-medium) var(--m3e-easing-standard), border-color var(--m3e-duration-medium) var(--m3e-easing-standard)

    &__thumb
        position: absolute
        top: 50%
        left: 0.5rem
        width: 1rem
        height: 1rem
        border-radius: var(--shape-corner-full)
        background: var(--outline)
        box-shadow: var(--m3e-elevation-1)
        transform: translateY(-50%)
        transition:
            left var(--m3e-duration-medium) var(--m3e-easing-emphasized-decelerate),
            width var(--m3e-duration-medium) var(--m3e-easing-emphasized-decelerate),
            height var(--m3e-duration-medium) var(--m3e-easing-emphasized-decelerate),
            background-color var(--m3e-duration-medium) var(--m3e-easing-standard)

    &__input:checked ~ &__track
        background: var(--primary)
        border-color: var(--primary)

    &__input:checked ~ &__track &__thumb
        left: 1.5rem
        width: 1.5rem
        height: 1.5rem
        background: var(--on-primary)

    /* M3E 图标变体：thumb 恒 24px，未选中略贴左（保留呼吸感，不撞 border） */
    &.m3-switch--icons &__thumb
        left: 0.125rem
        width: 1.5rem
        height: 1.5rem

    &.m3-switch--icons &__input:checked ~ &__track &__thumb
        left: 1.5rem

    &__icon
        position: absolute
        top: 50%
        left: 50%
        width: 1rem
        height: 1rem
        transform: translate(-50%, -50%)
        transition: opacity var(--m3e-duration-medium) var(--m3e-easing-standard)

    &__icon--check
        fill: var(--primary)
        opacity: 0

    &__icon--close
        fill: var(--surface)
        opacity: 1

    &__input:checked ~ &__track &__icon--check
        opacity: 1

    &__input:checked ~ &__track &__icon--close
        opacity: 0
</style>
