/**
 * rehype 组件：将 `:::grid` 容器指令渲染为响应式图片画廊网格。
 *
 * 指令属性：
 * - `columns` 1~6 的整数，默认 3，非法值回退默认；
 * - `aspect` 形如 `16 / 10` 的宽高比字符串，默认 `16 / 10`，非法值回退默认；
 * - `fit` `cover` | `contain`，默认 `cover`。
 *
 * 每个网格分配独立的 `data-fancybox="image-grid-N"` 分组 ID，
 * 灯箱轮播范围仅限当前网格，不与文章整体图片组合并。
 */
import { h } from "hastscript";

let gallerySequence = 0;

const DEFAULT_COLUMNS = 3;
const DEFAULT_ASPECT_RATIO = "16 / 10";
const DEFAULT_FIT = "cover";
const MIN_COLUMNS = 1;
const MAX_COLUMNS = 6;

/**
 * 解析列数属性：仅接受 1~6 的整数，其余回退默认值。
 *
 * @param {unknown} value 指令属性原始值。
 * @returns {number}
 */
function parseColumns(value) {
	const columns = Number.parseInt(String(value ?? DEFAULT_COLUMNS), 10);
	return Number.isInteger(columns) &&
		columns >= MIN_COLUMNS &&
		columns <= MAX_COLUMNS
		? columns
		: DEFAULT_COLUMNS;
}

/**
 * 解析宽高比属性：接受 `宽 / 高` 形式且两者均大于 0，否则回退默认值。
 *
 * @param {unknown} value 指令属性原始值。
 * @returns {string} CSS `aspect-ratio` 可用的比例字符串。
 */
function parseAspectRatio(value) {
	if (typeof value !== "string") {
		return DEFAULT_ASPECT_RATIO;
	}

	const match = value.match(
		/^\s*(?<width>\d+(?:\.\d+)?)\s*\/\s*(?<height>\d+(?:\.\d+)?)\s*$/,
	);
	if (!match?.groups) {
		return DEFAULT_ASPECT_RATIO;
	}

	const { width, height } = match.groups;
	if (Number(width) <= 0 || Number(height) <= 0) {
		return DEFAULT_ASPECT_RATIO;
	}

	return `${width} / ${height}`;
}

/**
 * 解析填充方式属性：仅接受 `contain`，其余回退 `cover`。
 *
 * @param {unknown} value 指令属性原始值。
 * @returns {"cover" | "contain"}
 */
function parseFit(value) {
	return value === "contain" ? "contain" : DEFAULT_FIT;
}

/**
 * 从指令子树中递归收集全部 `<img>` 节点。
 *
 * @param {import('hast').RootContent[]} nodes 指令渲染后的 HAST 子节点。
 * @returns {import('hast').Element[]}
 */
function findImages(nodes = []) {
	const images = [];

	const visit = (node) => {
		if (!node || typeof node !== "object") {
			return;
		}

		if (node.type === "element" && node.tagName === "img") {
			images.push(node);
			return;
		}

		if (Array.isArray(node.children)) {
			for (const child of node.children) {
				visit(child);
			}
		}
	};

	for (const node of nodes) {
		visit(node);
	}

	return images;
}

/**
 * 将 `:::grid` 指令渲染为响应式图片画廊。
 *
 * @param {Record<string, unknown>} properties 指令属性。
 * @param {import('hast').RootContent[]} children 指令子节点。
 * @returns {import('hast').Element}
 */
export function ImageGridComponent(properties, children) {
	const images = findImages(children);
	if (images.length === 0) {
		return h(
			"div",
			{ class: "hidden" },
			'Invalid image grid. (Use a block directive containing one or more Markdown images: ":::grid ... :::")',
		);
	}

	const galleryId = `image-grid-${gallerySequence++}`;
	const columns = parseColumns(properties?.columns);
	const aspectRatio = parseAspectRatio(properties?.aspect);
	const fit = parseFit(properties?.fit);

	const items = images.map((image) => {
		image.properties = image.properties ?? {};
		// 本地/远端图片统一惰性加载，避免画廊造成额外首屏请求负担
		image.properties.loading = image.properties.loading ?? "lazy";
		image.properties.decoding = image.properties.decoding ?? "async";

		const src = String(image.properties.src ?? "");
		const alt = String(image.properties.alt ?? "");
		const title = String(image.properties.title ?? "") || alt;

		const itemChildren = [
			h(
				"a",
				{
					class: "image-grid__link no-styling",
					href: src,
					"data-fancybox": galleryId,
					"data-no-swup": "true",
					"data-caption": title,
				},
				[image],
			),
		];
		if (title) {
			itemChildren.push(
				h("figcaption", { class: "image-grid__caption" }, title),
			);
		}

		return h("figure", { class: "image-grid__item" }, itemChildren);
	});

	return h(
		"div",
		{
			class: "image-grid",
			"data-columns": String(columns),
			style: `--image-grid-columns: ${columns}; --image-grid-aspect-ratio: ${aspectRatio}; --image-grid-fit: ${fit};`,
		},
		items,
	);
}
