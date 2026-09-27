<script lang="ts">
/**
 * M3E AlertDialog — 警示对话框原子（官方 AlertDialog.kt 移植）。
 * 容器 corner-extra-large（28dp，官方 DialogTokens.ContainerShape）、
 * surface-container-high + elevation-3；icon（可选，顶部）+ title（headline-small）
 * + text（body-medium）+ 底部按钮行（官方 confirmButton/dismissButton，右对齐）。
 * 打开自动聚焦（ESC 可接收）、scrim/ESC 关闭、进场 scrim fade + 内容 scale 展开、
 * 退场对称动画后卸载（同 Dialog）。
 *
 * 用法：<AlertDialog bind:open={open} title="删除确认" text="确定要删除吗？"
 *          confirmButton={confirmBtn} dismissButton={dismissBtn} />
 */
import { tick } from "svelte";

let {
	open = $bindable(false),
	title,
	text,
	icon,
	confirmButton,
	dismissButton,
	class: className = "",
}: {
	/** 开合（$bindable），scrim/ESC 自动置 false */
	open?: boolean;
	/** 标题（headline-small） */
	title?: string | import("svelte").Snippet;
	/** 正文（body-medium） */
	text?: string | import("svelte").Snippet;
	/** 顶部图标插槽（可选） */
	icon?: import("svelte").Snippet;
	/** 确认按钮插槽（通常 TextButton） */
	confirmButton?: import("svelte").Snippet;
	/** 取消按钮插槽（通常 TextButton） */
	dismissButton?: import("svelte").Snippet;
	class?: string;
} = $props();

let dialogEl = $state<HTMLDivElement | undefined>();
let rendering = $state(false);
let closing = $state(false);

function close() {
	open = false;
}

function onKeydown(e: KeyboardEvent) {
	if (e.key === "Escape") {
		close();
	}
}

$effect(() => {
	if (open) {
		rendering = true;
		closing = false;
		tick().then(() => dialogEl?.focus());
	} else if (rendering) {
		closing = true;
	}
});
// 焦点陷阱 + 关闭后焦点返还触发元素（官方 Modal Dialog）
let lastFocused: HTMLElement | null = null;

function getFocusables(): HTMLElement[] {
	const dialog = dialogEl;
	if (!dialog) return [];
	return [
		...dialog.querySelectorAll<HTMLElement>(
			'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
		),
	].filter((el) => el.offsetParent !== null);
}

$effect(() => {
	if (!open) return;
	lastFocused = document.activeElement as HTMLElement | null;
	function onKey(e: KeyboardEvent) {
		if (e.key !== "Tab") return;
		const items = getFocusables();
		if (!items.length) return;
		const first = items[0];
		const last = items[items.length - 1];
		const activeIdx = items.indexOf(document.activeElement as HTMLElement);
		if (e.shiftKey && (activeIdx === 0 || activeIdx === -1)) {
			e.preventDefault();
			last.focus();
		} else if (
			!e.shiftKey &&
			(activeIdx === items.length - 1 || activeIdx === -1)
		) {
			e.preventDefault();
			first.focus();
		}
	}
	window.addEventListener("keydown", onKey);
	return () => {
		window.removeEventListener("keydown", onKey);
		lastFocused?.focus();
	};
});

function onAnimationEnd() {
	if (closing) {
		rendering = false;
		closing = false;
	}
}
</script>

{#if rendering}
    <div
        class="m3-alert-scrim {className}"
        class:m3-alert-scrim--closing={closing}
        role="presentation"
        onclick={close}
    ></div>
    <div
        bind:this={dialogEl}
        class="m3-alert"
        class:m3-alert--closing={closing}
        role="alertdialog"
        aria-modal="true"
        aria-label={typeof title === "string" ? title : undefined}
        tabindex="-1"
        onkeydown={onKeydown}
        onanimationend={onAnimationEnd}
    >
        {#if icon}
            <div class="m3-alert__icon">{@render icon()}</div>
        {/if}
        {#if title}
            <div class="m3-alert__title">
                {#if typeof title === "string"}{title}{:else}{@render title()}{/if}
            </div>
        {/if}
        {#if text}
            <div class="m3-alert__text">
                {#if typeof text === "string"}{text}{:else}{@render text()}{/if}
            </div>
        {/if}
        <div class="m3-alert__actions">
            {@render dismissButton?.()}
            {@render confirmButton?.()}
        </div>
    </div>
{/if}

<style lang="stylus">
/* 遮罩：fade 进出 */
.m3-alert-scrim
    position: fixed
    inset: 0
    z-index: 80
    background: unquote("color-mix(in oklab, var(--scrim, #000) 32%, transparent)")
    animation: m3-alert-scrim-in var(--m3e-duration-medium) var(--m3e-easing-standard) both

    &--closing
        animation: m3-alert-scrim-out var(--m3e-duration-short) var(--m3e-easing-standard) both

/* 对话框：scale 0.9→1 展开 + fade，退场对称 */
.m3-alert
    position: fixed
    top: 50%
    left: 50%
    z-index: 81
    transform: translate(-50%, -50%)
    display: flex
    flex-direction: column
    width: unquote("min(560px, calc(100vw - 48px))")
    min-width: 280px
    box-sizing: border-box
    padding: 24px
    border-radius: var(--shape-corner-xl)
    background: var(--surface-container-high)
    color: var(--on-surface)
    box-shadow: var(--m3e-elevation-3)
    outline: none
    animation: m3-alert-in var(--m3e-duration-medium) var(--m3e-easing-emphasized-decelerate) both

    &--closing
        animation: m3-alert-out var(--m3e-duration-short) var(--m3e-easing-emphasized-accelerate) both

    &__icon
        margin-bottom: 16px
        color: var(--primary)
        > :global(svg)
            width: 1.5rem
            height: 1.5rem

    &__title
        font: var(--m3e-type-headline-small)
        color: var(--on-surface)

    &__text
        margin-top: 16px
        font: var(--m3e-type-body-medium)
        color: var(--on-surface-variant)

    &__actions
        display: flex
        justify-content: flex-end
        gap: 8px
        margin-top: 24px

@keyframes m3-alert-scrim-in
    from
        opacity: 0
    to
        opacity: 1

@keyframes m3-alert-scrim-out
    from
        opacity: 1
    to
        opacity: 0

@keyframes m3-alert-in
    from
        opacity: 0
        transform: translate(-50%, -50%) scale(0.9)
    to
        opacity: 1
        transform: translate(-50%, -50%) scale(1)

@keyframes m3-alert-out
    from
        opacity: 1
        transform: translate(-50%, -50%) scale(1)
    to
        opacity: 0
        transform: translate(-50%, -50%) scale(0.9)
</style>
