<script lang="ts">
/**
 * 区块标题（可复用）：可选图标 + 标题 + 可选副标题。
 * 页面级大标题用 PageHeader；区块/卡片内的小标题用本组件。
 */
import Icon from "@iconify/svelte";

let {
	title = "",
	subtitle = "",
	icon = "",
	class: className = "",
}: {
	title: string;
	subtitle?: string;
	/** 标题左侧装饰图标（Iconify 名） */
	icon?: string;
	class?: string;
} = $props();
</script>

<div class="section-title {className}">
	<div class="section-title__row">
		{#if icon}
			<span class="section-title__icon" aria-hidden="true">
				<Icon {icon} />
			</span>
		{/if}
		<h2 class="section-title__title">{title}</h2>
	</div>
	{#if subtitle}
		<p class="section-title__subtitle">{subtitle}</p>
	{/if}
</div>

<style lang="stylus">
.section-title
	margin-bottom: 0.75rem

	&__row
		display: flex
		align-items: center
		gap: 0.5rem

	&__icon
		display: inline-flex
		flex-shrink: 0
		color: var(--primary)
		> :global(svg)
			width: 1.25rem
			height: 1.25rem

	&__title
		margin: 0
		color: var(--on-surface)
		font: var(--m3e-type-title-large)
		font-weight: 700
		line-height: 1.3

	&__subtitle
		margin: 0.25rem 0 0
		color: var(--on-surface-variant)
		font: var(--m3e-type-body-small)
		line-height: 1.5
</style>
