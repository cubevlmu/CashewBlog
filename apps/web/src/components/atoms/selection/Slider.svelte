<script lang="ts">
/**
 * M3E Slider — 色相滑块原子。
 * 还原原子化前的经典视觉：彩虹轨道带（--color-selection-bar，明暗自适应）
 * + 白色矩形滑块（hover/active 亮度微调）。仅供色相选择使用。
 */
let {
	value = $bindable(50),
	min = 0,
	max = 100,
	step = 1,
	label = "",
}: {
	value?: number;
	min?: number;
	max?: number;
	step?: number;
	label?: string;
} = $props();
</script>

<div class="m3-slider-wrap">
    <input
        type="range"
        {min}
        {max}
        {step}
        bind:value
        aria-label={label}
        class="m3-slider"
    />
</div>

<style lang="stylus">
.m3-slider-wrap
    height: 1.5rem
    padding: 0 0.25rem
    border-radius: var(--shape-corner-xs)
    background-image: var(--color-selection-bar)
    user-select: none
    transition: background-image 0.15s ease-in-out

.m3-slider
    -webkit-appearance: none
    appearance: none
    width: 100%
    height: 1.5rem
    margin: 0
    background: transparent
    cursor: pointer

    /* Thumb：白色矩形条（原视觉）+ 主题自适应分离描边（亮色彩虹轨道上防融入） */
    &::-webkit-slider-thumb
        -webkit-appearance: none
        appearance: none
        height: 1rem
        width: 0.5rem
        border-radius: 0.125rem
        background: rgba(255, 255, 255, 0.7)
        box-shadow: unquote("0 0 0 1px color-mix(in oklab, var(--on-surface) 35%, transparent)")
        &:hover
            background: rgba(255, 255, 255, 0.8)
        &:active
            background: rgba(255, 255, 255, 0.6)

    &::-moz-range-thumb
        height: 1rem
        width: 0.5rem
        border-radius: 0.125rem
        background: rgba(255, 255, 255, 0.7)
        box-shadow: unquote("0 0 0 1px color-mix(in oklab, var(--on-surface) 35%, transparent)")
        &:hover
            background: rgba(255, 255, 255, 0.8)
        &:active
            background: rgba(255, 255, 255, 0.6)

    &::-ms-thumb
        height: 1rem
        width: 0.5rem
        border-radius: 0.125rem
        background: rgba(255, 255, 255, 0.7)
        box-shadow: unquote("0 0 0 1px color-mix(in oklab, var(--on-surface) 35%, transparent)")
        &:hover
            background: rgba(255, 255, 255, 0.8)
        &:active
            background: rgba(255, 255, 255, 0.6)

    &:focus-visible
        outline: 2px solid var(--primary)
        outline-offset: 2px
</style>
