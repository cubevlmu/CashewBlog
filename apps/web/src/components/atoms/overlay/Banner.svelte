<script lang="ts">
import Icon from "@iconify/svelte";

/**
 * M3E Banner — M3 横幅原子（官方 Banner 移植，token 对齐 v0.192 md-comp-banner）：
 * - 容器 surface-container-low + --m3e-elevation-1；shape: square（默认，标准 v0.192 方角）/ round（最新版 28px 圆角）；
 * - 标准形态：单行 52px（无图标）/ 带图标 72px / 多行自适应增高，吻合官方 token；
 * - compact 紧凑形态：圆角 + 图标 + 多操作也能保持单行小高度（约 52px），适合提示条/内嵌横幅场景；
 * - 可选 leading 图标：标准 40px 圆形 primary 24px / compact 24px 圆形 primary 16px；
 * - actions：TextButton 风格（label-large primary、state layer），右侧排列；
 * - 通用场景：公告、Cookie 提示、离线提醒、新版本发布等。
 */
let {
	text = "",
	icon = "",
	actions = [] as { label: string; onClick?: () => void }[],
	shape = "square",
	compact = false,
	class: className = "",
}: {
	/** 支持文本（body-medium on-surface-variant） */
	text?: string;
	/** 可选 leading 图标（Iconify 名；标准 40px 圆形 primary 24px / compact 24px 圆形 primary 16px） */
	icon?: string;
	/** 操作按钮（TextButton 风格，label-large primary，最多 2 个） */
	actions?: { label: string; onClick?: () => void }[];
	/** 容器圆角：square（默认，标准方角）/ round（最新版 28px） */
	shape?: "square" | "round";
	/** 紧凑形态：图标/内边距缩小，单行小高度（约 52px）也能放下图标 + 多个操作 */
	compact?: boolean;
	class?: string;
} = $props();
</script>

<div
	class="m3-banner m3-banner--{shape} {compact ? "m3-banner--compact" : ""} {className}"
>
	{#if icon}
		<span class="m3-banner__icon" aria-hidden="true"><Icon icon={icon} /></span>
	{/if}
	<p class="m3-banner__text">{text}</p>
	{#if actions.length}
		<div class="m3-banner__actions">
			{#each actions as action (action.label)}
				<button
					type="button"
					class="m3-banner__action m3-state-layer"
					onclick={action.onClick}
				>
					{action.label}
				</button>
			{/each}
		</div>
	{/if}
</div>

<style lang="stylus">
.m3-banner
	display: flex
	align-items: center
	gap: 1rem
	box-sizing: border-box
	padding: 1rem
	background: var(--surface-container-low)
	box-shadow: var(--m3e-elevation-1)

	&--round
		border-radius: var(--shape-corner-xl) /* 最新版 banners round：corner-extra-large 28px */

	&--compact
		padding: 0.875rem 1rem /* 上下 14px：24px 内容区 + 28px padding = 52px 单行小高度 */
		min-height: 3.25rem /* 统一紧凑单行 52px（纯文本时也为 52px） */

		.m3-banner__icon
			width: 1.5rem
			height: 1.5rem

			> :global(svg)
				width: 16px
				height: 16px

		.m3-banner__actions
			margin-block: -0.5rem /* 40px 触摸目标 - 24px 内容区 = 16px，上下各 -8px */

	&__icon
		display: flex
		align-items: center
		justify-content: center
		width: 2.5rem
		height: 2.5rem
		border-radius: var(--shape-corner-full)
		color: var(--primary)
		flex: none

		> :global(svg)
			width: 24px
			height: 24px

	&__text
		flex: 1
		min-width: 0
		margin: 0
		font: var(--m3e-type-body-medium)
		color: var(--on-surface-variant)
		overflow-wrap: break-word

	&__actions
		display: flex
		align-items: center
		gap: 0.5rem
		flex: none
		/* 40px 触摸目标不撑高容器：容器高度由文本/图标 + padding 决定（官方 52/72dp） */
		margin-block: -0.625rem

	&__action
		display: inline-flex
		align-items: center
		justify-content: center
		height: 2.5rem
		padding: 0 0.75rem
		border: none
		border-radius: var(--shape-corner-m)
		background: transparent
		color: var(--primary)
		font: var(--m3e-type-label-large)
		cursor: pointer
		white-space: nowrap
		--m3e-state-color: var(--primary)
</style>
