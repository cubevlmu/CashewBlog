<script lang="ts">
/**
 * M3E Snackbar — M3 提示条原子（官方 SnackbarTokens）。
 * 由全局事件总线（utils/snackbar.ts）驱动，纯 JS 环境也能触发。
 * 支持 action（操作按钮，label-large + inverse-primary）、icon（24dp）、两行文字。
 * 需挂载在 Layout 中：<Snackbar client:only="svelte" />
 */
import Icon from "@iconify/svelte";
import { SNACKBAR_EVENT, type SnackbarDetail } from "@utils/snackbar";
import { onMount } from "svelte";

let message = $state("");
let icon = $state("");
let actionLabel = $state("");
let actionOnClick: (() => void) | null = null;
let visible = $state(false);
let timer: ReturnType<typeof setTimeout> | null = null;

function show(detail: SnackbarDetail) {
	message = detail.message;
	icon = detail.icon ?? "";
	actionLabel = detail.action?.label ?? "";
	actionOnClick = detail.action?.onClick ?? null;
	visible = true;
	if (timer) clearTimeout(timer);
	timer = setTimeout(() => (visible = false), 3500);
}

function handleAction() {
	actionOnClick?.();
	visible = false;
	if (timer) clearTimeout(timer);
}

onMount(() => {
	const listener = (e: Event) => {
		const detail = (e as CustomEvent<SnackbarDetail>).detail;
		if (detail?.message) show(detail);
	};
	window.addEventListener(SNACKBAR_EVENT, listener);
	return () => window.removeEventListener(SNACKBAR_EVENT, listener);
});
</script>

<div class="m3-snackbar" class:visible={visible} role="status" aria-live="polite">
    {#if icon}
        <span class="m3-snackbar__icon" aria-hidden="true"><Icon icon={icon}></Icon></span>
    {/if}
    <span class="m3-snackbar__message">{message}</span>
    {#if actionLabel}
        <button type="button" class="m3-snackbar__action" onclick={handleAction}>{actionLabel}</button>
    {/if}
</div>

<style lang="stylus">
.m3-snackbar
    position: fixed
    left: 50%
    bottom: 1.5rem
    /* 官方 SnackbarHost：fade + scale 0.8↔1（FastEffects/FastSpatial），无 slide */
    transform: translate(-50%, 0) scale(0.8)
    display: flex
    align-items: center
    min-height: 3rem
    padding: 0.875rem 1rem
    gap: 0.5rem
    max-width: min(calc(100vw - 2rem), 40rem)
    border-radius: var(--shape-corner-xs)
    /* 明暗自适应表面：白天浅色、暗色深色，避免纯白主题下深黑弹条突兀 */
    background: var(--surface-container-high)
    color: var(--on-surface)
    font: var(--m3e-type-body-medium)
    box-shadow: var(--m3e-elevation-3)
    border: 1px solid var(--outline-variant)
    opacity: 0
    pointer-events: none
    transition: opacity var(--m3e-duration-short) var(--m3e-easing-standard), transform var(--m3e-duration-medium) var(--m3e-easing-emphasized-decelerate)
    z-index: 100

    &.visible
        opacity: 1
        transform: translate(-50%, 0) scale(1)
        pointer-events: auto

    &__icon
        display: flex
        flex-shrink: 0
        > :global(svg)
            width: 1.5rem
            height: 1.5rem

    &__action
        margin-left: auto
        padding: 0.25rem 0.5rem
        margin-right: -0.25rem
        border: none
        background: none
        color: var(--primary)
        font: var(--m3e-type-label-large)
        cursor: pointer
        border-radius: var(--shape-corner-xs)
        white-space: nowrap
        &:hover
            background: unquote("color-mix(in srgb, var(--primary) 8%, transparent)")
        &:focus-visible
            outline: 2px solid var(--primary)
            outline-offset: 2px
</style>
