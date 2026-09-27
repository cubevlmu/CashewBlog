/**
 * 最小动效补丁插件（M3E）。
 * - prefersReducedMotion()：统一「系统偏好 / 站点手动开关」的动效降级检测；
 * - collapse：Svelte action，高度 0↔auto 的展开/折叠动画，
 *   WAAPI 驱动（可取消、无逐帧 rAF 开销），reduced-motion 时直接到位；
 * - reveal：Svelte action，淡入上移的入场动画（列表 stagger 用），
 *   WAAPI 驱动，delay 逐项递增形成阶梯入场，reduced-motion 时直接到位；
 * - 集合变更原语（revealIn / fadeOutThenHide / flipFromRect）：
 *   非 Svelte 场景（如 SideBar 的 pages 过滤）按需组合的元素级函数，
 *   与上面 action 同一套曲线与降级约定。
 * - observeLayoutShifts：短生命周期布局变化的通用 FLIP 观察器。
 */

/** 是否应降级动效：系统 prefers-reduced-motion 或站点手动开关（html.motion-reduced） */
export function prefersReducedMotion(): boolean {
	if (typeof window === "undefined") return false;
	return (
		window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ||
		document.documentElement.classList.contains("motion-reduced")
	);
}

/** Wait for layout-affecting CSS transitions on an element to settle. */
export async function waitForLayoutTransitions(
	el: HTMLElement | null,
): Promise<void> {
	if (!el || prefersReducedMotion()) return;
	const transitions = el
		.getAnimations()
		.filter((animation) => animation instanceof CSSTransition);
	if (transitions.length === 0) return;
	await Promise.allSettled(transitions.map((animation) => animation.finished));
}

export interface CollapseParams {
	/** 目标状态：true 展开 / false 收起 */
	open: boolean;
	/** 是否播放过渡；初始化或数据重组时可直接落到终态 */
	animate?: boolean;
	/** 数据版本变化时直接同步终态，不把重组误判为交互 */
	resetKey?: unknown;
	/** 动画时长 ms（默认 240，M3 emphasized） */
	duration?: number;
}

/** M3 emphasized 缓动曲线（collapse / reveal / 布局 FLIP 重排共用） */
export const EASING_EMPHASIZED = "cubic-bezier(0.2, 0, 0, 1)";

/** M3 emphasized-decelerate：进入/展开（reveal / 集合入场共用） */
export const EASING_DECELERATE = "cubic-bezier(0.05, 0.7, 0.1, 1)";

/** M3 emphasized-accelerate：退出/收起（集合退场共用） */
export const EASING_ACCELERATE = "cubic-bezier(0.3, 0, 0.8, 0.15)";

const COLLAPSE_EASING = EASING_EMPHASIZED; // M3 emphasized-decelerate

/**
 * 声明式展开/折叠插件：
 *   <div use:collapse={{ open: expanded }}>...</div>
 * 内容高度在 0 ↔ auto 间过渡；reduced-motion 时跳过动画直接切换。
 */
export function collapse(node: HTMLElement, params: CollapseParams) {
	let anim: Animation | null = null;
	let currentParams = params;
	let current = currentParams.open;
	let resetKey = currentParams.resetKey;

	node.style.overflow = "hidden";
	node.style.height = current ? "auto" : "0px";

	function settle(open: boolean) {
		node.style.height = open ? "auto" : "0px";
	}

	function play(open: boolean, shouldAnimate = true) {
		anim?.cancel();
		if (!shouldAnimate || prefersReducedMotion()) {
			settle(open);
			return;
		}
		const from = open ? 0 : node.scrollHeight;
		const to = open ? node.scrollHeight : 0;
		if (from === to) {
			settle(open);
			return;
		}
		node.style.height = `${from}px`;
		anim = node.animate([{ height: `${from}px` }, { height: `${to}px` }], {
			duration: currentParams.duration ?? 240,
			easing: COLLAPSE_EASING,
		});
		anim.onfinish = () => settle(open);
		anim.oncancel = () => settle(current);
	}

	return {
		update(next: CollapseParams) {
			currentParams = next;
			if (next.resetKey !== resetKey) {
				resetKey = next.resetKey;
				current = next.open;
				anim?.cancel();
				settle(current);
				return;
			}
			if (next.open === current) return;
			current = next.open;
			play(current, next.animate !== false);
		},
		destroy() {
			anim?.cancel();
			node.style.height = "";
			node.style.overflow = "";
		},
	};
}

export interface RevealParams {
	/** 起始延迟 ms（stagger：第 i 项传 i × step） */
	delay?: number;
	/** 动画时长 ms（默认 250，M3 medium） */
	duration?: number;
}

const REVEAL_EASING = EASING_DECELERATE;

/**
 * 入场动画插件（列表 stagger / 区块淡入）：
 *   <div use:reveal={{ delay: i * 45 }}>...</div>
 * 从 opacity 0 + translateY(0.25rem) 淡入到位；
 * WAAPI 驱动（可取消、无逐帧 rAF 开销），reduced-motion 时直接到位。
 */
export function reveal(node: HTMLElement, params: RevealParams = {}) {
	let anim: Animation | null = null;
	let currentParams = params;

	function play() {
		anim?.cancel();
		if (prefersReducedMotion()) {
			node.style.opacity = "";
			node.style.transform = "";
			return;
		}
		anim = node.animate(
			[
				{ opacity: 0, transform: "translateY(0.25rem)" },
				{ opacity: 1, transform: "translateY(0)" },
			],
			{
				duration: currentParams.duration ?? 250,
				delay: currentParams.delay ?? 0,
				easing: REVEAL_EASING,
				fill: "both",
			},
		);
	}

	play();

	return {
		update(next: RevealParams) {
			currentParams = next;
			play();
		},
		destroy() {
			anim?.cancel();
		},
	};
}

/* ============================================================
   集合与布局变更原语（非 Svelte 场景的元素级函数）
   典型消费方：SideBar 的 pages 过滤（swup 导航后组件显隐 + 兄弟位移）。
   约定：WAAPI 驱动、只动 transform/opacity、时长对齐动效令牌、
   prefersReducedMotion() 命中时直接到位。
   ============================================================ */

export interface RevealInParams {
	/** 起始延迟 ms（多元素 stagger 用） */
	delay?: number;
	/** 动画时长 ms（默认 250 = --m3e-duration-medium） */
	duration?: number;
}

/**
 * 元素级入场（reveal action 的非 Svelte 版本）：
 * 淡入 + 上移 0.25rem 到位，emphasized-decelerate；reduced-motion 直接到位。
 */
export function revealIn(el: HTMLElement, params: RevealInParams = {}): void {
	if (prefersReducedMotion()) return;
	el.animate(
		[
			{ opacity: 0, transform: "translateY(0.25rem)" },
			{ opacity: 1, transform: "translateY(0)" },
		],
		{
			duration: params.duration ?? 250,
			delay: params.delay ?? 0,
			easing: EASING_DECELERATE,
			fill: "both",
		},
	);
}

/**
 * 淡出后挂 hidden（150ms = --m3e-duration-short，emphasized-accelerate）。
 * 返回动画结束的 Promise（后续位移 FLIP 需等退场让出布局再开始）；
 * reduced-motion 立即隐藏。结束后 cancel 释放 fill，不留内联样式。
 */
export async function fadeOutThenHide(
	el: HTMLElement,
	duration = 150,
): Promise<void> {
	if (prefersReducedMotion() || el.classList.contains("hidden")) {
		el.classList.add("hidden");
		return;
	}
	const anim = el.animate([{ opacity: 1 }, { opacity: 0 }], {
		duration,
		easing: EASING_ACCELERATE,
		fill: "forwards",
	});
	try {
		await anim.finished;
	} catch {
		// Ownership passed to a newer collection sync; leave visibility unchanged.
		return;
	}
	el.classList.add("hidden");
	anim.cancel();
}

/**
 * 单元素 FLIP：从变更前记录的 getBoundingClientRect 平移回当前平面位置
 * （默认 250ms = --m3e-duration-medium，emphasized）。位移为零时跳过。
 * 与 layout-mode 的卡片重排共用；调用方负责在 DOM 变更前记录 rect。
 */
export function flipFromRect(
	el: HTMLElement,
	rect: DOMRect,
	duration = 250,
): void {
	if (prefersReducedMotion()) return;
	const dx = rect.left - el.getBoundingClientRect().left;
	const dy = rect.top - el.getBoundingClientRect().top;
	if (!dx && !dy) return;
	el.animate(
		[
			{ transform: `translate(${dx}px, ${dy}px)` },
			{ transform: "translate(0, 0)" },
		],
		{ duration, easing: EASING_EMPHASIZED },
	);
}

/**
 * 在短生命周期布局更新期间平滑元素的位置变化。
 * ResizeObserver 只负责发现 sizeSource 的尺寸变化；目标元素用 FLIP transform
 * 从上一个文档坐标过渡到新坐标，不改变布局。返回清理函数供导航结束时调用。
 */
export function observeLayoutShifts(
	el: HTMLElement,
	sizeSource: HTMLElement,
	duration = 250,
): () => void {
	let animation: Animation | null = null;
	const documentRect = () => {
		const rect = el.getBoundingClientRect();
		return {
			left: rect.left + window.scrollX,
			top: rect.top + window.scrollY,
		};
	};
	let previous = documentRect();

	const observer = new ResizeObserver(() => {
		if (prefersReducedMotion()) {
			animation?.cancel();
			animation = null;
			previous = documentRect();
			return;
		}

		const visual = animation ? documentRect() : previous;
		animation?.cancel();
		const next = documentRect();
		const dx = visual.left - next.left;
		const dy = visual.top - next.top;
		previous = next;
		if (!dx && !dy) return;

		animation = el.animate(
			[
				{ transform: `translate(${dx}px, ${dy}px)` },
				{ transform: "translate(0, 0)" },
			],
			{ duration, easing: EASING_EMPHASIZED },
		);
		animation.onfinish = () => {
			animation = null;
		};
	});

	observer.observe(sizeSource);
	return () => {
		observer.disconnect();
		animation?.cancel();
	};
}
