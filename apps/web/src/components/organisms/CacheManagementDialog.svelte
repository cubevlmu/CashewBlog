<script lang="ts">
import Dialog from "@components/atoms/overlay/Dialog.svelte";
import Icon from "@iconify/svelte";
import IconButton from "@components/atoms/action/IconButton.svelte";
import { onMount } from "svelte";
import { cacheReport, clearCache, formatBytes, persistCache, type CacheBucket, type CacheReport } from "@utils/browser-cache";

let open = $state(false);
let { showLabel = false }: { showLabel?: boolean } = $props();
let report = $state<CacheReport | null>(null);
let busy = $state(false);
let message = $state("");
const labels: Record<CacheBucket, { title: string; detail: string }> = {
	static: { title: "程序资源", detail: "CSS、JavaScript、字体与图标" },
	images: { title: "图片资源", detail: "公开图片与站点图像" },
	pages: { title: "页面校验缓存", detail: "公开 HTML 的本地副本" },
};
async function refresh() { report = await cacheReport(); }
async function clear(bucket?: CacheBucket) {
	busy = true;
	message = "";
	try { await clearCache(bucket); message = bucket ? "已清理该缓存。" : "已清理全部浏览器缓存。"; await refresh(); }
	catch { message = "缓存清理失败，请稍后重试。"; }
	finally { busy = false; }
}
async function makePersistent() {
	message = await persistCache() ? "浏览器已允许保留缓存。" : "浏览器未授予持久化存储权限。";
	await refresh();
}
onMount(() => { void refresh(); });
</script>

<span class="cache-entry" class:cache-entry--label={showLabel}>
	<IconButton icon="material-symbols:database-outline-rounded" label="浏览器缓存管理" onclick={() => (open = true)} />
	{#if showLabel}<span class="cache-entry__text">缓存</span>{/if}
</span>
<Dialog bind:open title="浏览器缓存管理" class="cashew-cache-dialog">
	<div class="cashew-cache-dialog__body">
		<p class="cashew-cache-dialog__hint">基础 CSS、JavaScript 和字体会优先从本机复用；页面内容仍会在线校验，登录信息不会写入缓存。</p>
		{#if message}<p class="cashew-cache-dialog__message" role="status">{message}</p>{/if}
		{#if report?.available}
			<div class="cashew-cache-dialog__list">
				{#each report.buckets as bucket}
					<div class="cashew-cache-dialog__row">
						<div class="cashew-cache-dialog__label"><strong>{labels[bucket.bucket].title}</strong><span>{labels[bucket.bucket].detail}</span></div>
						<div class="cashew-cache-dialog__size"><strong>{bucket.entries} 项</strong><span>{formatBytes(bucket.bytes)}</span></div>
						<button type="button" class="cashew-cache-dialog__clear" disabled={busy || bucket.entries === 0} aria-label={`清理${labels[bucket.bucket].title}`} onclick={() => clear(bucket.bucket)}><Icon icon="material-symbols:delete-outline-rounded" /></button>
					</div>
				{/each}
			</div>
			<p class="cashew-cache-dialog__meta">浏览器总占用：{formatBytes(report.usage)}{report.quota ? ` / ${formatBytes(report.quota)}` : ""} · {report.persisted ? "已持久化" : "可能被浏览器回收"}</p>
		{:else}
			<p class="cashew-cache-dialog__hint">当前浏览器不支持持久缓存，仍会使用普通 HTTP 缓存。</p>
		{/if}
	</div>
	{#snippet actions()}
		<button type="button" class="m3-button m3-button--outlined m3-button--small" disabled={busy || !report?.available} onclick={makePersistent}>请求保留缓存</button>
		<button type="button" class="m3-button m3-button--outlined m3-button--small" disabled={busy || !report?.available} onclick={() => clear()}>清理全部</button>
	{/snippet}
</Dialog>

<style lang="stylus">
.cache-entry
	display: inline-flex
	align-items: center
	gap: .125rem

.cache-entry__text
	font: var(--m3e-type-label-medium)
	color: var(--on-surface-variant)

.cashew-cache-dialog
	width: unquote("min(34rem, calc(100vw - 2rem))")

.cashew-cache-dialog__body
	display: flex
	flex-direction: column
	gap: 1rem

.cashew-cache-dialog__hint,
.cashew-cache-dialog__meta,
.cashew-cache-dialog__message
	margin: 0
	font: var(--m3e-type-body-medium)
	color: var(--on-surface-variant)

.cashew-cache-dialog__message
	color: var(--primary)

.cashew-cache-dialog__list
	display: flex
	flex-direction: column
	gap: .5rem

.cashew-cache-dialog__row
	display: flex
	align-items: center
	gap: .75rem
	padding: .75rem
	border: 1px solid var(--outline-variant)
	border-radius: var(--shape-corner-m)

.cashew-cache-dialog__label
	display: flex
	flex-direction: column
	min-width: 0
	flex: 1
	gap: .15rem
	span
		font: var(--m3e-type-label-small)
		color: var(--on-surface-variant)

.cashew-cache-dialog__size
	display: flex
	flex-direction: column
	align-items: flex-end
	white-space: nowrap
	span
		font: var(--m3e-type-label-small)
		color: var(--on-surface-variant)

.cashew-cache-dialog__clear
	display: grid
	place-items: center
	width: 2.25rem
	height: 2.25rem
	border: 0
	border-radius: var(--shape-corner-full)
	background: transparent
	color: var(--error)
	cursor: pointer
	&:disabled
		opacity: .35
		cursor: default
</style>
