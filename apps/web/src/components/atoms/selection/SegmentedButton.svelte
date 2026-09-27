<script lang="ts">
/**
 * M3E SegmentedButton — M3 分段按钮（单选 / 多选，官方 SegmentedButton +
 * MultiChoiceSegmentedButton）。
 * 容器 --surface-container，选中段 --secondary-container。
 * 选中段显示 check 图标（官方 fadeIn + scaleIn，origin 底部左角）。
 * 单选：<SegmentedButton options={[{value,label}]} bind:value={spec} />
 * 多选：<SegmentedButton multiple options={...} bind:checkedValues={[]} />
 */
import Icon from "@iconify/svelte";

let {
	options = [],
	value = $bindable(""),
	checkedValues = $bindable([]),
	label = "",
	disabled = false,
	multiple = false,
}: {
	options: { value: string; label: string }[];
	/** 单选值（$bindable） */
	value?: string;
	/** 多选选中集（$bindable，multiple 时） */
	checkedValues?: string[];
	label?: string;
	disabled?: boolean;
	/** true = 多选（官方 MultiChoiceSegmentedButton） */
	multiple?: boolean;
} = $props();
</script>

<div class="m3-segmented" role="group" aria-label={label}>
    {#each options as opt (opt.value)}
        <label
            class="m3-segmented__segment"
            class:selected={multiple ? checkedValues.includes(opt.value) : value === opt.value}
        >
            {#if multiple}
                <input
                    type="checkbox"
                    value={opt.value}
                    bind:group={checkedValues}
                    {disabled}
                    class="m3-segmented__input"
                />
            {:else}
                <input
                    type="radio"
                    name={label}
                    value={opt.value}
                    bind:group={value}
                    {disabled}
                    class="m3-segmented__input"
                />
            {/if}
            <span class="m3-segmented__check" aria-hidden="true">
                <Icon icon="material-symbols:check"></Icon>
            </span>
            <span>{opt.label}</span>
        </label>
    {/each}
</div>

<style lang="stylus">
.m3-segmented
    display: flex
    gap: 2px
    padding: 2px
    border-radius: var(--shape-corner-m)
    background: var(--surface-container)

    /* 隐藏原生 input（保留可聚焦与键盘支持，display:none 会移出焦点序） */
    &__input
        position: absolute
        width: 1px
        height: 1px
        opacity: 0
        overflow: hidden
        clip: rect(0 0 0 0)
        white-space: nowrap
        clip-path: inset(50%)

    &__segment
        flex: 1
        display: flex
        align-items: center
        justify-content: center
        gap: 0.25rem
        height: 2rem
        padding: 0 0.75rem
        border-radius: var(--shape-corner-s)
        font: var(--m3e-type-label-medium)
        color: var(--on-surface-variant)
        cursor: pointer
        user-select: none
        text-align: center
        line-height: 1.25
        transition: background-color var(--m3e-duration-short) var(--m3e-easing-standard), color var(--m3e-duration-short) var(--m3e-easing-standard), box-shadow var(--m3e-duration-short) var(--m3e-easing-standard)

        &:hover
            background: unquote("color-mix(in oklab, var(--on-surface) 8%, transparent)")

        &.selected
            background: var(--secondary-container)
            color: var(--on-secondary-container)
            box-shadow: var(--m3e-elevation-1)

        &:has(input:focus-visible)
            outline: 2px solid var(--primary)
            outline-offset: 1px

    /* 选中 check 图标：scaleIn + fade（官方 TransformOrigin(0,1) 底部左角 + FastSpatial） */
    &__check
        display: flex
        flex-shrink: 0
        transform: scale(0)
        opacity: 0
        transform-origin: left bottom
        transition:
            transform var(--m3e-duration-medium) var(--m3e-easing-emphasized-decelerate),
            opacity var(--m3e-duration-short) var(--m3e-easing-standard)
        > :global(svg)
            width: 1rem
            height: 1rem

    &__segment.selected &__check
        transform: scale(1)
        opacity: 1
</style>
