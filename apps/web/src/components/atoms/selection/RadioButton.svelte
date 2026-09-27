<script lang="ts">
/**
 * M3E RadioButton — M3 单选按钮原子（移植自 Compose Material3 RadioButton）。
 * 原生 <input type="radio"> 提供无障碍与单选组语义，自绘 20px 外环 + 12px 内点。
 * 用法：<RadioButton bind:checked={selected} label="Option A" />
 */
let {
	checked = $bindable(false),
	disabled = false,
	label = "",
	onchange = () => {},
}: {
	checked?: boolean;
	disabled?: boolean;
	label?: string;
	onchange?: () => void;
} = $props();

function handleChange() {
	checked = true;
	onchange();
}
</script>

<label class="m3-radio" class:disabled={disabled}>
    <input
        type="radio"
        checked={checked}
        {disabled}
        aria-label={label}
        onchange={handleChange}
        class="m3-radio__input"
    />
    <span class="m3-radio__ring m3-state-layer">
        <span class="m3-radio__dot"></span>
    </span>
</label>

<style lang="stylus">
.m3-radio
    display: inline-flex
    cursor: pointer
    -webkit-tap-highlight-color: transparent

    &.disabled
        opacity: 0.38
        pointer-events: none

    /* 隐藏原生 radio（保留可访问性） */
    &__input
        position: absolute
        width: 1px
        height: 1px
        opacity: 0
        overflow: hidden
        clip: rect(0 0 0 0)
        white-space: nowrap
        clip-path: inset(50%)

    &__ring
        position: relative
        display: flex
        align-items: center
        justify-content: center
        width: 1.25rem
        height: 1.25rem
        border-radius: var(--shape-corner-full)
        border: 2px solid var(--on-surface-variant)
        box-sizing: border-box
        transition: border-color var(--m3e-duration-short) var(--m3e-easing-standard)

    &__dot
        width: 0.75rem
        height: 0.75rem
        border-radius: var(--shape-corner-full)
        background: var(--primary)
        transform: scale(0)
        transition: transform var(--m3e-duration-medium) var(--m3e-easing-emphasized-decelerate)

    /* 选中：环变 primary + 内点生长 */
    &__input:checked ~ &__ring
        border-color: var(--primary)
    &__input:checked ~ &__ring &__dot
        transform: scale(1)

    &__input:focus-visible ~ &__ring
        outline: 2px solid var(--primary)
        outline-offset: 2px
</style>
