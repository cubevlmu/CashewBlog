<script lang="ts">
/**
 * M3E BottomSheet — 模态底部弹层原子（官方 ModalBottomSheet 移植）。
 * 遮罩淡入 + 面板从底部滑入（translateY 100%→0，emphasized-decelerate 400ms），
 * 顶部 16dp 圆角（官方 ShapeCornerTopLarge）、surface-container-low、把手
 * （官方 DragHandle）。宽度 max 656dp 居中（官方 ModalContainerWidth），
 * 移动端全宽。
 * 关闭：遮罩点击 / Esc（onclose 或 open $bindable 置 false）。
 * 简化实现：不做拖拽手势（anchors/半高）与 scrollBehavior。
 *
 * 用法：<BottomSheet bind:open={open} title="标题">内容{/bottomSheet}
 *      或 <BottomSheet bind:open={open}>内容</BottomSheet>
 */
import { onMount } from "svelte";

let {
	open = $bindable(false),
	title,
	class: className = "",
	children,
}: {
	/** 弹层开合（$bindable），遮罩点击/Esc 自动置 false */
	open?: boolean;
	/** 标题（可选，头部大标题 headline-small） */
	title?: string;
	class?: string;
	children?: import("svelte").Snippet;
} = $props();

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
    class="m3-sheet-root {className}"
    class:m3-sheet-root--open={open}
>
    <div class="m3-sheet__scrim" aria-hidden="true" onclick={() => (open = false)}></div>
    <div class="m3-sheet" role="dialog" aria-modal="true" aria-label={title ?? "底部弹层"}>
        <div class="m3-sheet__handle" aria-hidden="true"></div>
        {#if title}
            <div class="m3-sheet__title">{title}</div>
        {/if}
        <div class="m3-sheet__content">
            {@render children?.()}
        </div>
    </div>
</div>

<style lang="stylus">
.m3-sheet-root
    position: fixed
    inset: 0
    z-index: 70
    visibility: hidden
    pointer-events: none

    &.m3-sheet-root--open
        visibility: visible
        pointer-events: auto

    .m3-sheet__scrim
        position: absolute
        inset: 0
        background: unquote("color-mix(in oklab, var(--scrim, #000) 32%, transparent)")
        opacity: 0
        transition: opacity var(--m3e-duration-medium) var(--m3e-easing-standard)

    &.m3-sheet-root--open .m3-sheet__scrim
        opacity: 1

    /* 面板：底部滑入，顶部 16dp 圆角，surface-container-low */
    .m3-sheet
        position: absolute
        left: 50%
        bottom: 0
        transform: translateX(-50%) translateY(100%)
        width: 100%
        max-width: 656px
        max-height: 80vh
        box-sizing: border-box
        display: flex
        flex-direction: column
        background: var(--surface-container-low)
        color: var(--on-surface)
        border-radius: var(--shape-corner-l) var(--shape-corner-l) 0 0
        transition: transform var(--m3e-duration-long) var(--m3e-easing-emphasized-decelerate)

    &.m3-sheet-root--open .m3-sheet
        transform: translateX(-50%) translateY(0)

    .m3-sheet__handle
        width: 32px
        height: 4px
        margin: 12px auto 4px
        border-radius: var(--shape-corner-full)
        background: var(--on-surface-variant)
        opacity: 0.4
        flex: none

    .m3-sheet__title
        font: var(--m3e-type-headline-small)
        padding: 8px 24px 0

    .m3-sheet__content
        padding: 16px 24px 24px
        overflow-y: auto
</style>
