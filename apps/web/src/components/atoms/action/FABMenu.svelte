<script lang="ts">
/**
 * M3E FABMenu — 悬浮菜单原子（M3 Expressive 2025，移植自 Compose
 * FloatingActionButtonMenu + ToggleFloatingActionButton）。
 *
 * 变体：
 * - size：small(56)/medium(80)/large(96)，展开时统一收缩到 56 全圆 + close 图标
 * - align：end（默认，右对齐）/ start（左对齐）/ center（居中）
 * - containerColor：收起容器色（默认 primary-container），展开变 primary
 * - menuItemColor/menuItemContentColor：菜单项颜色（默认 primary-container 系）
 * - 图标 Crossfade 切换（add ↔ close，50% progress 处交替）
 * - 动画：rAF 驱动 --fab-progress（0→1，300ms emphasized-decelerate，
 *   对应官方 FastSpatial），容器颜色/尺寸/圆角/图标颜色/图标大小统一按 progress 插值
 * - 键盘焦点：展开时 Tab / ArrowDown 进入第一个菜单项
 * 菜单项由调用方通过 .m3-fab-menu-item 类提供（56px 全圆、图标 18px + body-medium）。
 *
 * 用法：
 *   <FABMenu bind:expanded={open} label="菜单" size="medium" align="start">
 *     <button class="m3-fab-menu-item" onclick={...}>
 *       <Icon icon="material-symbols:edit" /> 编辑
 *     </button>
 *   </FABMenu>
 */
import Icon from "@iconify/svelte";
import {
	announceMenuOpened,
	MENU_EXCLUSIVE_EVENT,
	nextMenuInstanceId,
} from "@utils/menu-bus";
import { onMount, untrack } from "svelte";

let {
	expanded = $bindable(false),
	icon = "material-symbols:add",
	iconExpanded = "material-symbols:close",
	label = "",
	size = "small",
	align = "end",
	containerColor = "var(--primary-container)",
	containerContentColor = "var(--on-primary-container)",
	menuItemColor = "var(--primary-container)",
	menuItemContentColor = "var(--on-primary-container)",
	exclusive = true,
	class: className = "",
}: {
	expanded?: boolean;
	icon?: string;
	iconExpanded?: string;
	label?: string;
	size?: "small" | "medium" | "large";
	align?: "end" | "start" | "center";
	containerColor?: string;
	containerContentColor?: string;
	menuItemColor?: string;
	menuItemContentColor?: string;
	exclusive?: boolean;
	class?: string;
} = $props();

const instanceId = nextMenuInstanceId();

// 动效降级：系统偏好或站点手动开关（html.motion-reduced）→ 展开/收起直接到位
function isMotionReduced(): boolean {
	if (typeof window === "undefined") return false;
	return (
		window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ||
		document.documentElement.classList.contains("motion-reduced")
	);
}

// 展开进度 0→1，rAF 逐帧驱动（官方 checkedProgress，FastSpatial ~300ms）
let progress = $state(0);
let rafId: number | null = null;

$effect(() => {
	const target = expanded ? 1 : 0;
	untrack(() => {
		const from = progress;
		if (from === target) return;
		if (isMotionReduced()) {
			progress = target;
			return;
		}
		const DURATION = 300;
		const start = performance.now();
		// emphasized-decelerate 近似：cubic-bezier(0.05, 0.7, 0.1, 1)
		const ease = (t: number) => 1 - (1 - t) ** 2.5;
		const tick = (now: number) => {
			const t = Math.min((now - start) / DURATION, 1);
			progress = from + (target - from) * ease(t);
			rafId = t < 1 ? requestAnimationFrame(tick) : null;
		};
		rafId = requestAnimationFrame(tick);
	});
	return () => {
		if (rafId !== null) cancelAnimationFrame(rafId);
		rafId = null;
	};
});

// 键盘焦点：展开时 Tab / ArrowDown 进入第一个菜单项（官方 onKeyEvent）
function onFabKeydown(e: KeyboardEvent) {
	if (!expanded) return;
	if ((e.key === "Tab" && !e.shiftKey) || e.key === "ArrowDown") {
		e.preventDefault();
		const itemsEl = fabMenuEl?.querySelector(".m3-fab-menu__items");
		const first = itemsEl?.querySelector<HTMLElement>(".m3-fab-menu-item");
		first?.focus();
	}
}

let fabMenuEl: HTMLDivElement;

// 互斥单开：展开时广播，其他同总线实例自动收起
$effect(() => {
	if (!exclusive || !expanded) return;
	const t = setTimeout(() => announceMenuOpened(instanceId), 0);
	return () => clearTimeout(t);
});

onMount(() => {
	const onExclusive = (e: Event) => {
		const detail = (e as CustomEvent).detail;
		if (detail?.instanceId !== instanceId && expanded) expanded = false;
	};
	document.addEventListener(MENU_EXCLUSIVE_EVENT, onExclusive);
	return () => document.removeEventListener(MENU_EXCLUSIVE_EVENT, onExclusive);
});
</script>

<div
    class="m3-fab-menu m3-fab-menu--{size} m3-fab-menu--{align} {className}"
    class:m3-fab-menu--expanded={expanded}
    style={`--fab-container-color: ${containerColor}; --fab-on-container-color: ${containerContentColor}; --fab-menu-item-bg: ${menuItemColor}; --fab-menu-item-color: ${menuItemContentColor}; --fab-progress: ${progress}`}
    bind:this={fabMenuEl}
>
    <div class="m3-fab-menu__items" aria-hidden={!expanded} inert={!expanded}>
        <slot />
    </div>
    <button
        type="button"
        class="m3-fab-menu__fab m3-state-layer"
        aria-haspopup="menu"
        aria-expanded={expanded}
        aria-label={label}
        onclick={() => (expanded = !expanded)}
        onkeydown={onFabKeydown}
    >
        <span class="m3-fab-menu__icon">
            <Icon icon={icon}></Icon>
        </span>
        <span class="m3-fab-menu__icon m3-fab-menu__icon--alt">
            <Icon icon={iconExpanded}></Icon>
        </span>
    </button>
</div>

<style lang="stylus">
.m3-fab-menu
    position: relative
    display: inline-flex
    flex-direction: column

    /* 菜单列：FAB 上方展开 */
    &__items
        position: absolute
        bottom: 100%
        margin-bottom: 0.5rem
        display: flex
        flex-direction: column
        gap: 0.25rem
        white-space: nowrap
        pointer-events: none /* 收起时容器不拦截指针 */

    /* FAB 触发器：全部由 --fab-progress（0→1）统一插值。
       官方 lerp：颜色 primary-container→primary、尺寸 size→56、圆角 radius→28px 全圆 */
    &__fab
        display: flex
        align-items: center
        justify-content: center
        border: none
        cursor: pointer
        box-shadow: var(--m3e-elevation-3)
        width: unquote("calc(var(--fab-size) * (1 - var(--fab-progress)) + 3.5rem * var(--fab-progress))")
        height: unquote("calc(var(--fab-size) * (1 - var(--fab-progress)) + 3.5rem * var(--fab-progress))")
        border-radius: unquote("calc(var(--fab-radius) * (1 - var(--fab-progress)) + 1.75rem * var(--fab-progress))")
        background: unquote("color-mix(in oklab, var(--primary) calc(var(--fab-progress) * 100%), var(--fab-container-color))")
        color: unquote("color-mix(in oklab, var(--on-primary) calc(var(--fab-progress) * 100%), var(--fab-on-container-color))")
        --m3e-state-color: unquote("color-mix(in oklab, var(--on-primary) calc(var(--fab-progress) * 100%), var(--fab-on-container-color))")

    /* 图标：两个叠放，50% progress 处 Crossfade 交替（官方 50% 切换） */
    &__icon
        position: absolute
        display: flex
        opacity: unquote("calc(1 - var(--fab-progress) * 2)")
        > :global(svg)
            width: unquote("calc(var(--fab-icon) * (1 - var(--fab-progress)) + 1.25rem * var(--fab-progress))")
            height: unquote("calc(var(--fab-icon) * (1 - var(--fab-progress)) + 1.25rem * var(--fab-progress))")

    &__icon--alt
        opacity: unquote("calc(var(--fab-progress) * 2 - 1)")

    /* === 尺寸三档（官方 FabBaseline/FabMedium/FabLargeTokens） === */
    &--small
        --fab-size: 3.5rem
        --fab-radius: 16px
        --fab-icon: 1.5rem
    &--medium
        --fab-size: 5rem
        --fab-radius: 20px
        --fab-icon: 1.75rem
    &--large
        --fab-size: 6rem
        --fab-radius: 28px
        --fab-icon: 2.25rem

    /* === 对齐变体（官方 horizontalAlignment + center） === */
    &--end
        align-items: flex-end
        .m3-fab-menu__items
            align-items: flex-end
    &--start
        align-items: flex-start
        .m3-fab-menu__items
            align-items: flex-start
    &--center
        align-items: center
        .m3-fab-menu__items
            left: 50%
            transform: translateX(-50%)

    /* 菜单项（调用方提供）：56px 全圆、图标 18px + body-medium；颜色可经
       menuItemColor / menuItemContentColor 配置 */
    :global(.m3-fab-menu-item)
        display: flex
        align-items: center
        gap: 0.5rem
        min-width: 3.5rem
        height: 3.5rem
        padding: 0 1.5rem
        border: none
        border-radius: var(--shape-corner-full)
        background: var(--fab-menu-item-bg)
        color: var(--fab-menu-item-color)
        font: var(--m3e-type-body-medium)
        text-align: left
        white-space: nowrap
        cursor: pointer
        box-shadow: var(--m3e-elevation-1)
        transition: opacity var(--m3e-duration-medium) var(--m3e-easing-standard), transform var(--m3e-duration-medium) var(--m3e-easing-emphasized-decelerate)
        opacity: 0
        pointer-events: none /* 收起时不可命中，避免遮挡下方内容 */
        transform: translateY(0.5rem)
        > :global(svg)
            width: 1.125rem
            height: 1.125rem
            flex-shrink: 0

    /* stagger：逐项延迟淡入上移 */
    &--expanded .m3-fab-menu__items
        pointer-events: auto

    &--expanded :global(.m3-fab-menu-item)
        opacity: 1
        transform: none
        pointer-events: auto
    &--expanded :global(.m3-fab-menu-item:nth-child(1))
        transition-delay: 30ms
    &--expanded :global(.m3-fab-menu-item:nth-child(2))
        transition-delay: 60ms
    &--expanded :global(.m3-fab-menu-item:nth-child(3))
        transition-delay: 90ms
    &--expanded :global(.m3-fab-menu-item:nth-child(4))
        transition-delay: 120ms
    &--expanded :global(.m3-fab-menu-item:nth-child(5))
        transition-delay: 150ms
    &--expanded :global(.m3-fab-menu-item:nth-child(6))
        transition-delay: 180ms
</style>
