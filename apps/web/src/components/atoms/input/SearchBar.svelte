<script lang="ts">
/**
 * M3E SearchBar — 搜索条原子（官方 SearchBar.kt 移植，docked 展开视图）。
 * 收起态 56dp pill（SearchBarTokens：surface-container-high、elevation-3）；
 * 展开态整体 corner-extra-large(28dp) + Divider + 内容插槽
 * （ExpandedDockedSearchBar：header 56dp + 建议/结果列表，由调用方提供）。
 *
 * 交互（官方）：
 * - 点击 / focus → 展开 + 聚焦输入框（touch 模式 focus→expand）
 * - ESC / 点击外部 / close 按钮 → 收起（BackHandler + dismiss）
 * - 回车 → onsearch(query)（IME Search action）
 * - 展开时 ArrowDown → 焦点移入内容区第一个可聚焦项（moveFocus down）
 *
 * 用法：
 *   <SearchBar bind:query={q} onsearch={(q) => search(q)}>
 *     {#each results as r}<a class="m3-search-result" href={r.url}>{r.title}</a>{/each}
 *   </SearchBar>
 */
import Icon from "@iconify/svelte";
import { onMount, type Snippet, tick } from "svelte";

let {
	expanded = $bindable(false),
	query = $bindable(""),
	placeholder = "搜索",
	label = "搜索",
	onsearch,
	class: className = "",
	children,
}: {
	expanded?: boolean;
	query?: string;
	placeholder?: string;
	label?: string;
	onsearch?: (query: string) => void;
	class?: string;
	children?: Snippet;
} = $props();

let inputEl: HTMLInputElement;
let rootEl: HTMLDivElement;

// 点击 bar → 展开 + 聚焦输入框（官方 touch 模式 focus→expand）
async function onFieldClick() {
	expanded = true;
	await tick();
	inputEl?.focus();
}

// 回车搜索 / ESC 收起 / ArrowDown 进内容列表（官方 onPreviewKeyEvent）
function onInputKeydown(e: KeyboardEvent) {
	if (e.key === "Enter") {
		onsearch?.(query);
	} else if (e.key === "Escape") {
		expanded = false;
		inputEl?.blur();
	} else if (e.key === "ArrowDown" && expanded) {
		e.preventDefault();
		const targets = rootEl?.querySelectorAll<HTMLElement>(
			".m3-search-bar__content a, .m3-search-bar__content button, .m3-search-bar__content [tabindex]",
		);
		targets?.[0]?.focus();
	}
}

// 点击外部收起（官方 onDismissRequest）
function onDocMousedown(e: MouseEvent) {
	const target = e.target as Node;
	if (rootEl && !rootEl.contains(target)) expanded = false;
}

onMount(() => {
	document.addEventListener("mousedown", onDocMousedown);
	return () => document.removeEventListener("mousedown", onDocMousedown);
});
</script>

<div
    class="m3-search-bar {className}"
    class:m3-search-bar--expanded={expanded && children}
    bind:this={rootEl}
>
    <div class="m3-search-bar__field" onclick={onFieldClick}>
        <span class="m3-search-bar__leading" aria-hidden="true">
            <Icon icon="material-symbols:search"></Icon>
        </span>
        <input
            class="m3-search-bar__input"
            bind:this={inputEl}
            bind:value={query}
            placeholder={placeholder}
            aria-label={label}
            type="search"
            onkeydown={onInputKeydown}
        />
        {#if expanded}
            <button
                type="button"
                class="m3-search-bar__trailing"
                aria-label="关闭搜索"
                onclick={(e) => {
                    e.stopPropagation();
                    expanded = false;
                    inputEl?.blur();
                }}
            >
                <Icon icon="material-symbols:close"></Icon>
            </button>
        {:else if query}
            <button
                type="button"
                class="m3-search-bar__trailing"
                aria-label="清除"
                onclick={(e) => {
                    e.stopPropagation();
                    query = "";
                }}
            >
                <Icon icon="material-symbols:close"></Icon>
            </button>
        {/if}
    </div>
    {#if children}
        <div class="m3-search-bar__expand">
            <div class="m3-search-bar__divider" aria-hidden="true"></div>
            <div class="m3-search-bar__content" aria-hidden={!expanded} inert={!expanded}>
                {@render children()}
            </div>
        </div>
    {/if}
</div>

<style lang="stylus">
.m3-search-bar
    position: relative
    display: flex
    flex-direction: column
    width: 100%

    /* 收起态 field：56dp pill（官方 SearchBarTokens.ContainerHeight/Shape） */
    &__field
        display: flex
        align-items: center
        gap: 0.75rem
        min-height: 3.5rem
        padding: 0 0.75rem 0 1.25rem
        border-radius: var(--shape-corner-xl)
        background: var(--surface-container-high)
        color: var(--on-surface)
        box-shadow: var(--m3e-elevation-3)
        cursor: text
        /* 聚焦指示（官方 SearchBarTokens.FocusIndicatorColor = Secondary）；仅收起态，
           展开态容器 shadow 已是视觉焦点，outline 会与 divider 叠加成难看的黑边 */
        &:focus-within
            outline: 2px solid var(--secondary)
            outline-offset: 2px

    &__leading
        display: flex
        flex-shrink: 0
        color: var(--on-surface)
        > :global(svg)
            width: 1.5rem
            height: 1.5rem

    &__input
        flex: 1
        min-width: 0
        border: none
        background: none
        color: var(--on-surface)
        font: var(--m3e-type-body-large)
        outline: none
        &::placeholder
            color: var(--on-surface-variant)
        /* 隐藏原生 search 清除按钮，用自绘 trailing */
        &::-webkit-search-cancel-button
            display: none

    &__trailing
        display: flex
        flex-shrink: 0
        padding: 0.25rem
        border: none
        background: none
        color: var(--on-surface-variant)
        cursor: pointer
        border-radius: var(--shape-corner-full)
        > :global(svg)
            width: 1.5rem
            height: 1.5rem
        &:hover
            background: unquote("color-mix(in oklab, var(--on-surface-variant) 8%, transparent)")
        &:focus-visible
            outline: 2px solid var(--secondary)
            outline-offset: 2px

    /* 展开区：Divider + 内容，官方 DockedEnterTransition（fadeIn + expandVertically
       600ms emphasized-decelerate）/ DockedExitTransition（fadeOut + shrinkVertically 350ms linear）。
       transition 定义在目标态控制「进入该状态」的时长/曲线 */
    &__expand
        overflow: hidden
        max-height: 0
        opacity: 0
        border-radius: 0 0 var(--shape-corner-xl) var(--shape-corner-xl)
        transition:
            max-height 350ms linear,
            opacity 350ms linear

    &--expanded
        background: var(--surface-container-high)
        border-radius: var(--shape-corner-xl)
        box-shadow: var(--m3e-elevation-3)
        .m3-search-bar__field
            box-shadow: none
            background: none
            /* 底部直角，与 divider/展开区无缝连接（收起态 pill 四角全圆） */
            border-radius: var(--shape-corner-xl) var(--shape-corner-xl) 0 0
            &:focus-within
                outline: none
        .m3-search-bar__expand
            max-height: 24rem
            opacity: 1
            transition:
                max-height 600ms var(--m3e-easing-emphasized-decelerate),
                opacity 600ms var(--m3e-easing-emphasized-decelerate)

    &__divider
        height: 1px
        border: none
        background: var(--outline)
        margin: 0

    /* 内容区（建议/结果，调用方提供）：可滚动；
       展开时容器展开后延迟淡入（官方 AnimationForContentFadeInSpec：100ms + 50ms delay） */
    &__content
        max-height: 20rem
        overflow-y: auto
        padding: 0.5rem
        opacity: 0
        transition: opacity 100ms var(--m3e-easing-standard)

    &--expanded &__content
        opacity: 1
        transition: opacity 100ms var(--m3e-easing-standard) 50ms
</style>
