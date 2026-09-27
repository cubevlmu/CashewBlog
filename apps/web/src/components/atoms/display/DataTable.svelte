<script lang="ts">
/**
 * M3E DataTable — M3 数据表格原子（官方 DataTable 移植，token 对齐 v0.192 md-comp-data-table）：
 * - 容器 corner-extra-small（4px）+ outline-variant 1px 描边；
 * - 表头 56px：title-small on-surface-variant，hover 变 on-surface，可排序列带排序图标（升/降序切换）；
 * - 行高 52px：body-medium on-surface，行间 outline-variant 1px 分隔线；
 * - 选中行 surface-container-highest 高亮（可复选列，Checkbox 联动 selected 数组）；
 * - 排序由父级接管：点击表头触发 onsort({ key, direction })，组件仅维护指示图标状态；
 * - 可选 footer（surface + body-medium on-surface-variant）。
 */
let {
	columns = [],
	rows = [],
	selectable = false,
	selected = $bindable([]),
	sortKey = "",
	sortDirection = "",
	footer = "",
	onclick,
	onsort,
	class: className = "",
	style = "",
}: {
	/** 列定义：{ key, title, sortable?, align? } */
	columns?: {
		key: string;
		title: string;
		sortable?: boolean;
		align?: "start" | "center" | "end";
	}[];
	/** 行数据：{ id, cells: Record<key, string>, disabled? } */
	rows?: {
		id: string | number;
		cells: Record<string, string>;
		disabled?: boolean;
	}[];
	/** 是否显示复选列 */
	selectable?: boolean;
	/** 选中行 id 数组（$bindable） */
	selected?: (string | number)[];
	/** 当前排序列 key（仅控制指示图标） */
	sortKey?: string;
	/** 排序方向："" / "asc" / "desc" */
	sortDirection?: "asc" | "desc" | "";
	/** footer 支持文本 */
	footer?: string;
	/** 行点击回调 */
	onclick?: (row: {
		id: string | number;
		cells: Record<string, string>;
		disabled?: boolean;
	}) => void;
	/** 排序列点击回调：({ key, direction }) */
	onsort?: (detail: { key: string; direction: "asc" | "desc" }) => void;
	class?: string;
	style?: string;
} = $props();

function handleSort(col: { key: string; title: string; sortable?: boolean }) {
	if (!col.sortable) return;
	const dir = sortKey === col.key && sortDirection === "asc" ? "desc" : "asc";
	onsort?.({ key: col.key, direction: dir });
}

function handleRowClick(row: {
	id: string | number;
	cells: Record<string, string>;
	disabled?: boolean;
}) {
	if (row.disabled) return;
	onclick?.(row);
}

function toggleRow(id: string | number) {
	if (selected.includes(id)) {
		selected = selected.filter((x) => x !== id);
	} else {
		selected = [...selected, id];
	}
}

function toggleAll() {
	if (selected.length === rows.length) {
		selected = [];
	} else {
		selected = rows.map((r) => r.id);
	}
}

function cellAlign(col: { align?: "start" | "center" | "end" }) {
	return col.align === "center"
		? "center"
		: col.align === "end"
			? "end"
			: "start";
}
</script>

<div class="m3-data-table {className}" {style}>
	<table>
		<thead>
			<tr>
				{#if selectable}
					<th class="m3-data-table__checkbox">
						<input type="checkbox" checked={selected.length === rows.length && rows.length > 0}
							onchange={toggleAll} aria-label="全选" />
					</th>
				{/if}
				{#each columns as col (col.key)}
					<th class={"align-" + cellAlign(col)} class:m3-data-table__sortable={col.sortable}
						role={col.sortable ? "button" : undefined}
						tabindex={col.sortable ? 0 : undefined}
						onclick={() => handleSort(col)}
						onkeydown={(e) => col.sortable && (e.key === "Enter" || e.key === " ") && handleSort(col)}>
						<span class="m3-data-table__header-label">{col.title}</span>
						{#if col.sortable}
							<span class="m3-data-table__sort-icon" aria-hidden="true">
								{#if sortKey === col.key && sortDirection}
									<span class:desc={sortDirection === "desc"}>{sortDirection === "asc" ? "↑" : "↓"}</span>
								{:else}
									<span class="idle">↕</span>
								{/if}
							</span>
						{/if}
					</th>
				{/each}
			</tr>
		</thead>
		<tbody>
			{#each rows as row (row.id)}
				<tr class:m3-data-table__selected={selected.includes(row.id)}
					class:m3-data-table__disabled={row.disabled}
					class:m3-state-layer={!!onclick}
					onclick={() => handleRowClick(row)}>
					{#if selectable}
						<td class="m3-data-table__checkbox">
							<input type="checkbox" checked={selected.includes(row.id)} disabled={row.disabled}
								onchange={() => toggleRow(row.id)} aria-label="选择行" />
						</td>
					{/if}
					{#each columns as col (col.key)}
						<td class={"align-" + cellAlign(col)}>{row.cells[col.key] ?? ""}</td>
					{/each}
				</tr>
			{/each}
		</tbody>
	</table>
	{#if footer}
		<div class="m3-data-table__footer">{footer}</div>
	{/if}
</div>

<style lang="stylus">
.m3-data-table
	display: inline-block
	border-radius: var(--shape-corner-xs) /* corner-extra-small 4px */
	border: 1px solid var(--outline-variant)
	background: var(--surface)
	overflow: hidden
	box-sizing: border-box

	table
		border-collapse: collapse
		width: 100%

	th, td
		padding: 0 1rem /* 16px */
		text-align: start

	thead tr
		height: 3.5rem /* 56px */
		background: var(--surface)
		color: var(--on-surface-variant)
		font: var(--m3e-type-title-small)

	th
		user-select: none

		&.align-center
			text-align: center
		&.align-end
			text-align: end

		&.m3-data-table__sortable
			cursor: pointer

			&:hover .m3-data-table__header-label
				color: var(--on-surface)

	.m3-data-table__header-label
		display: inline-flex

	.m3-data-table__sort-icon
		display: inline-flex
		align-items: center
		justify-content: center
		width: 1.5rem
		height: 1.5rem
		margin-inline-start: 0.25rem
		font-size: 1rem
		color: var(--on-surface-variant)
		vertical-align: middle

		.idle
			opacity: 0.6

		.desc
			transform: rotate(180deg)

	tbody tr
		height: 3.25rem /* 52px */
		background: var(--surface)
		color: var(--on-surface)
		font: var(--m3e-type-body-medium)
		border-top: 1px solid var(--outline-variant)

		&.m3-data-table__selected
			background: var(--surface-container-highest)

		&.m3-data-table__disabled
			color: var(--on-surface)
			opacity: 0.38
			pointer-events: none

	td
		&.align-center
			text-align: center
		&.align-end
			text-align: end

	.m3-data-table__checkbox
		width: 3.5rem /* 56px */
		padding: 0 0 0 1rem
		text-align: start

		input[type="checkbox"]
			accent-color: var(--primary)
			width: 1.125rem
			height: 1.125rem
			cursor: pointer

	.m3-data-table__footer
		height: 3.25rem /* 52px */
		display: flex
		align-items: center
		padding: 0 1rem
		background: var(--surface)
		color: var(--on-surface-variant)
		font: var(--m3e-type-body-medium)
		border-top: 1px solid var(--outline-variant)
</style>