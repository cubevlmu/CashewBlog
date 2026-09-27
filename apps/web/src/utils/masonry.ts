/**
 * 瀑布流打包（grid row-span 实现，无绝对定位）：
 * 卡片保持文档流与语义，仅由 JS 赋 `grid-column-start`（最短列分配，
 * 顺序接近行主序）与 `grid-row-end: span N`（N = 卡片高度换算的行数）。
 * 列数仍由 CSS `repeat(auto-fill, minmax(--post-card-min, 1fr))` 决定，
 * 本模块只做分配——容器换列数（resize）后重新 pack 即可。
 *
 * 配套约定（PostPage 样式，两处需同步改）：
 * - grid 模式 `grid-auto-rows: 8px`、`row-gap: 0`（行距烘焙进 span）；
 * - 行距 = ROW_GAP px（与 column-gap 同值，均对应 --m3e-space-4）。
 */

const ROW_UNIT = 8; // px，对应 PostPage grid-auto-rows
const ROW_GAP = 16; // px，烘焙进 span 的视觉行距（--m3e-space-4）

/** 最短列打包：给每张卡片设置列定位与行跨度；单列时清空内联定位 */
export function packMasonry(container: HTMLElement): void {
	const cards = Array.from(container.children) as HTMLElement[];
	if (cards.length === 0) return;

	for (const card of cards) {
		card.style.gridColumnStart = "";
		card.style.gridColumnEnd = "";
		card.style.gridRowEnd = "";
	}

	const colCount = getComputedStyle(container)
		.gridTemplateColumns.split(" ")
		.filter(Boolean).length;

	if (colCount <= 1) return;

	const measurements = cards.map((card) => {
		const height = card.offsetHeight;
		const gridColumnEnd = getComputedStyle(card).gridColumnEnd;
		const spanMatch = gridColumnEnd.match(/span\s+(\d+)/);
		const dataSpan = Number.parseInt(card.dataset.masonrySpan ?? "", 10);
		const span = Math.min(
			Math.max(
				Number.isFinite(dataSpan)
					? dataSpan
					: spanMatch
						? Number.parseInt(spanMatch[1], 10)
						: 1,
				1,
			),
			colCount,
		);
		return { card, height, span };
	});

	const columnHeights = new Array<number>(colCount).fill(0);
	const plans = [];

	for (const { card, height, span } of measurements) {
		let shortest = 0;
		let shortestHeight = Number.POSITIVE_INFINITY;
		for (let col = 0; col <= colCount - span; col++) {
			const candidateHeight = Math.max(...columnHeights.slice(col, col + span));
			if (candidateHeight < shortestHeight) {
				shortest = col;
				shortestHeight = candidateHeight;
			}
		}
		plans.push({
			card,
			colStart: String(shortest + 1),
			colEnd: `span ${span}`,
			rowEnd: `span ${Math.ceil((height + ROW_GAP) / ROW_UNIT)}`,
		});
		for (let col = shortest; col < shortest + span; col++) {
			columnHeights[col] = shortestHeight + height + ROW_GAP;
		}
	}

	for (const plan of plans) {
		plan.card.style.gridColumnStart = plan.colStart;
		plan.card.style.gridColumnEnd = plan.colEnd;
		plan.card.style.gridRowEnd = plan.rowEnd;
	}
}

/**
 * 挂接瀑布流生命周期：立即 pack + 容器宽度变化（换列数）时重排。
 * swup 内容替换后容器是新元素，需对新区块重新调用。
 */
export function setupMasonry(container: HTMLElement): void {
	packMasonry(container);
	if (typeof ResizeObserver === "undefined") return;
	let frameId: number | null = null;
	const observer = new ResizeObserver(() => {
		if (frameId !== null) cancelAnimationFrame(frameId);
		frameId = requestAnimationFrame(() => {
			frameId = null;
			packMasonry(container);
		});
	});
	observer.observe(container);
}
