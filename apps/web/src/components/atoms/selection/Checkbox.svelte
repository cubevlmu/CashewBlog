<script lang="ts">
/**
 * M3E Checkbox — M3 复选框原子（移植自 Compose Material3 Checkbox）。
 * 原生 <input type="checkbox"> 提供无障碍与键盘支持，自绘 18px 方框。
 * triState 为 true 时支持三态：false → true → null（半选，横线）。
 * 用法：<Checkbox bind:checked={flag} label="Enable" />
 *      <Checkbox bind:checked={tri} label="Mixed" triState />
 */
let {
	checked = $bindable(false),
	disabled = false,
	label = "",
	triState = false,
}: {
	checked?: boolean | null;
	disabled?: boolean;
	label?: string;
	triState?: boolean;
} = $props();

let inputEl: HTMLInputElement;

// 同步原生 input 状态（triState 时 checked 与 indeterminate 都要显式设置，
// 因 null 与 false 的 checked===true 相同，Svelte 不会自动重置浏览器点击后的值）
$effect(() => {
	if (!inputEl) return;
	inputEl.checked = checked === true;
	inputEl.indeterminate = triState && checked === null;
});

function handleChange() {
	if (triState) {
		// false → true → null → false 循环
		checked = checked === false ? true : checked === true ? null : false;
	} else {
		checked = inputEl.checked;
	}
}
</script>

<label class="m3-checkbox" class:disabled={disabled}>
    <input
        type="checkbox"
        bind:this={inputEl}
        checked={checked === true}
        {disabled}
        aria-label={label}
        onchange={handleChange}
        class="m3-checkbox__input"
    />
    <span class="m3-checkbox__box m3-state-layer">
        <svg class="m3-checkbox__check" viewBox="0 0 20 20" aria-hidden="true">
            <path d="M5 10.2 8.2 13.4 15 6.2"></path>
        </svg>
        <svg class="m3-checkbox__dash" viewBox="0 0 20 20" aria-hidden="true">
            <path d="M5 10 H15"></path>
        </svg>
    </span>
</label>

<style lang="stylus">
.m3-checkbox
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

    &__box
        position: relative
        display: flex
        align-items: center
        justify-content: center
        width: 1.125rem
        height: 1.125rem
        border-radius: 2px
        border: 2px solid var(--on-surface-variant)
        box-sizing: border-box
        background: transparent
        transition: background-color var(--m3e-duration-short) var(--m3e-easing-standard), border-color var(--m3e-duration-short) var(--m3e-easing-standard)

    &__check, &__dash
        position: absolute
        width: 1.125rem
        height: 1.125rem
        fill: none
        stroke: var(--on-primary)
        stroke-width: 2
        stroke-linecap: round
        stroke-linejoin: round
        /* 勾选生长动画（官方 checkDrawFraction 描边生长近似 + 非对称：
           进入慢 decelerate，取消快 standard） */
        transform: scale(0)
        opacity: 0
        transition:
            transform var(--m3e-duration-short) var(--m3e-easing-standard),
            opacity var(--m3e-duration-short) var(--m3e-easing-standard)

    /* 选中：primary 填充 + 勾（生长放大淡入，origin center） */
    &__input:checked ~ &__box
        background: var(--primary)
        border-color: var(--primary)
    &__input:checked ~ &__box &__check
        transform: scale(1)
        opacity: 1
        transition:
            transform var(--m3e-duration-medium) var(--m3e-easing-emphasized-decelerate),
            opacity var(--m3e-duration-short) var(--m3e-easing-standard)

    /* 半选（triState）：primary 填充 + 横线 */
    &__input:indeterminate ~ &__box
        background: var(--primary)
        border-color: var(--primary)
    &__input:indeterminate ~ &__box &__dash
        transform: scale(1)
        opacity: 1
        transition:
            transform var(--m3e-duration-medium) var(--m3e-easing-emphasized-decelerate),
            opacity var(--m3e-duration-short) var(--m3e-easing-standard)

    /* checkbox 聚焦时给方框描边 */
    &__input:focus-visible ~ &__box
        outline: 2px solid var(--primary)
        outline-offset: 2px
</style>
