/**
 * 分享海报生成工具。
 *
 * 海报宽度固定，高度由封面、标题和摘要的实际排版决定。这样短内容不会在正文与
 * 页脚之间留下空洞，长内容也不会挤压作者和二维码区域。
 */

export const SHARE_POSTER_WIDTH = 1080;

const PAGE_PADDING = 64;
const CONTENT_WIDTH = SHARE_POSTER_WIDTH - PAGE_PADDING * 2;
const COVER_HEIGHT = 480;
const NO_COVER_HEADER_HEIGHT = 240;
const TITLE_FONT_SIZE = 56;
const TITLE_LINE_HEIGHT = 70;
const DESCRIPTION_FONT_SIZE = 30;
const DESCRIPTION_LINE_HEIGHT = 42;
const FOOTER_HEIGHT = 170;
const BOTTOM_PADDING = 48;
const FONT_FAMILY = 'Roboto, system-ui, -apple-system, "Segoe UI", sans-serif';

export interface SharePosterPalette {
	surfaceContainerLowest: string;
	surfaceContainerLow: string;
	surfaceContainerHigh?: string;
	onSurface: string;
	onSurfaceVariant: string;
	primary: string;
	primaryContainer: string;
	onPrimaryContainer: string;
	outlineVariant: string;
}

export interface SharePosterLabels {
	author: string;
	scanToRead: string;
}

export interface SharePosterInput {
	title: string;
	description: string;
	author: string;
	published: string;
	siteTitle: string;
	url: string;
	coverUrl?: string;
	avatarUrl?: string;
	labels: SharePosterLabels;
	palette: SharePosterPalette;
	signal?: AbortSignal;
}

interface DrawableImage {
	source: CanvasImageSource;
	close?: () => void;
}

interface PosterLayout {
	hasCover: boolean;
	headerHeight: number;
	contentTop: number;
	titleLines: string[];
	titleHeight: number;
	descriptionLines: string[];
	descriptionTop: number;
	descriptionHeight: number;
	dividerY: number;
	footerY: number;
	canvasHeight: number;
}

/** 净化文件名，移除 Windows / POSIX 非法字符与控制字符。 */
export function sanitizeFilename(
	name: string,
	fallback = "article-share",
): string {
	const cleaned = Array.from(name)
		.filter((char) => {
			const code = char.charCodeAt(0);
			return code >= 32 && code !== 127 && !'<>:"/\\|?*'.includes(char);
		})
		.join("")
		.trim()
		.replace(/\s+/g, "-");
	return cleaned || fallback;
}

/** 从页面读取当前生效的主题计算颜色。 */
export function getSharePosterPalette(
	element: HTMLElement = document.documentElement,
): SharePosterPalette {
	const style = getComputedStyle(element);
	const getVar = (name: string, fallback: string) => {
		const value = style.getPropertyValue(name).trim();
		return value || fallback;
	};

	return {
		surfaceContainerLowest: getVar("--surface-container-lowest", "#ffffff"),
		surfaceContainerLow: getVar("--surface-container-low", "#f7f2fa"),
		surfaceContainerHigh: getVar("--surface-container-high", "#ece6f0"),
		onSurface: getVar("--on-surface", "#1d1b20"),
		onSurfaceVariant: getVar("--on-surface-variant", "#49454f"),
		primary: getVar("--primary", "#6750a4"),
		primaryContainer: getVar("--primary-container", "#eaddff"),
		onPrimaryContainer: getVar("--on-primary-container", "#21005d"),
		outlineVariant: getVar("--outline-variant", "#cac4d0"),
	};
}

/** 带超时与 CORS 保护的可选图片加载器。失败时返回 null 供排版降级。 */
async function loadDrawableImage(
	url?: string,
	signal?: AbortSignal,
	timeoutMs = 6000,
): Promise<DrawableImage | null> {
	if (!url || signal?.aborted) return null;

	try {
		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
		const onAbort = () => controller.abort();
		signal?.addEventListener("abort", onAbort, { once: true });

		try {
			const response = await fetch(url, { signal: controller.signal });
			if (!response.ok) return null;

			const contentType = response.headers.get("content-type") || "";
			if (contentType && !contentType.startsWith("image/")) return null;

			const blob = await response.blob();
			if (blob.size > 15 * 1024 * 1024) return null;

			if (typeof createImageBitmap === "function") {
				const bitmap = await createImageBitmap(blob);
				return { source: bitmap, close: () => bitmap.close() };
			}

			return await new Promise<DrawableImage | null>((resolve) => {
				const image = new Image();
				const blobUrl = URL.createObjectURL(blob);
				image.onload = () => {
					resolve({
						source: image,
						close: () => URL.revokeObjectURL(blobUrl),
					});
				};
				image.onerror = () => {
					URL.revokeObjectURL(blobUrl);
					resolve(null);
				};
				image.src = blobUrl;
			});
		} finally {
			clearTimeout(timeoutId);
			signal?.removeEventListener("abort", onAbort);
		}
	} catch {
		return null;
	}
}

function segmentText(text: string, granularity: "word" | "grapheme"): string[] {
	if (!text) return [];
	if (typeof Intl !== "undefined" && "Segmenter" in Intl) {
		try {
			const segmenter = new Intl.Segmenter(undefined, { granularity });
			return Array.from(segmenter.segment(text), (segment) => segment.segment);
		} catch {
			// Fall through to the code-point-safe fallback.
		}
	}
	return Array.from(text);
}

/** 按可用宽度换行，达到上限后在最后一行追加省略号。 */
function wrapTextLines(
	ctx: CanvasRenderingContext2D,
	text: string,
	maxWidth: number,
	maxLines: number,
): string[] {
	const normalized = text.replace(/\s+/g, " ").trim();
	if (!normalized) return [];

	const tokens = segmentText(normalized, "word").flatMap((token) =>
		ctx.measureText(token).width > maxWidth
			? segmentText(token, "grapheme")
			: [token],
	);
	const lines: string[] = [];
	let currentLine = "";
	let truncated = false;

	for (let index = 0; index < tokens.length; index++) {
		const token = tokens[index];
		const candidate = currentLine + token;
		if (ctx.measureText(candidate).width <= maxWidth) {
			currentLine = candidate;
			continue;
		}

		if (currentLine) {
			lines.push(currentLine.trimEnd());
			if (lines.length === maxLines) {
				truncated = true;
				break;
			}
		}
		currentLine = token.trimStart();
	}

	if (!truncated && currentLine && lines.length < maxLines) {
		lines.push(currentLine.trimEnd());
	}

	if (truncated && lines.length > 0) {
		const ellipsis = "\u2026";
		let lastLine = lines[lines.length - 1];
		while (
			lastLine &&
			ctx.measureText(`${lastLine}${ellipsis}`).width > maxWidth
		) {
			lastLine = segmentText(lastLine, "grapheme").slice(0, -1).join("");
		}
		lines[lines.length - 1] = `${lastLine.trimEnd()}${ellipsis}`;
	}

	return lines;
}

function drawTextEllipsis(
	ctx: CanvasRenderingContext2D,
	text: string,
	x: number,
	y: number,
	maxWidth: number,
) {
	if (ctx.measureText(text).width <= maxWidth) {
		ctx.fillText(text, x, y);
		return;
	}

	const ellipsis = "\u2026";
	const graphemes = segmentText(text, "grapheme");
	while (
		graphemes.length > 0 &&
		ctx.measureText(`${graphemes.join("")}${ellipsis}`).width > maxWidth
	) {
		graphemes.pop();
	}
	ctx.fillText(`${graphemes.join("").trimEnd()}${ellipsis}`, x, y);
}

function drawRoundedRect(
	ctx: CanvasRenderingContext2D,
	x: number,
	y: number,
	width: number,
	height: number,
	radius: number,
) {
	ctx.beginPath();
	if (typeof ctx.roundRect === "function") {
		ctx.roundRect(x, y, width, height, radius);
		return;
	}
	ctx.moveTo(x + radius, y);
	ctx.lineTo(x + width - radius, y);
	ctx.arcTo(x + width, y, x + width, y + radius, radius);
	ctx.lineTo(x + width, y + height - radius);
	ctx.arcTo(x + width, y + height, x + width - radius, y + height, radius);
	ctx.lineTo(x + radius, y + height);
	ctx.arcTo(x, y + height, x, y + height - radius, radius);
	ctx.lineTo(x, y + radius);
	ctx.arcTo(x, y, x + radius, y, radius);
	ctx.closePath();
}

function drawCoverImage(
	ctx: CanvasRenderingContext2D,
	image: CanvasImageSource,
	x: number,
	y: number,
	width: number,
	height: number,
) {
	const dimensions = image as { width?: number; height?: number };
	const imageWidth = Number(dimensions.width) || width;
	const imageHeight = Number(dimensions.height) || height;
	const imageAspect = imageWidth / imageHeight;
	const targetAspect = width / height;

	let sourceX = 0;
	let sourceY = 0;
	let sourceWidth = imageWidth;
	let sourceHeight = imageHeight;
	if (imageAspect > targetAspect) {
		sourceWidth = imageHeight * targetAspect;
		sourceX = (imageWidth - sourceWidth) / 2;
	} else {
		sourceHeight = imageWidth / targetAspect;
		sourceY = (imageHeight - sourceHeight) / 2;
	}

	ctx.drawImage(
		image,
		sourceX,
		sourceY,
		sourceWidth,
		sourceHeight,
		x,
		y,
		width,
		height,
	);
}

function measurePosterLayout(
	ctx: CanvasRenderingContext2D,
	input: SharePosterInput,
	hasCover: boolean,
): PosterLayout {
	const headerHeight = hasCover ? COVER_HEIGHT : NO_COVER_HEADER_HEIGHT;
	const contentTop = headerHeight + PAGE_PADDING;

	ctx.font = `700 ${TITLE_FONT_SIZE}px ${FONT_FAMILY}`;
	const titleLines = wrapTextLines(
		ctx,
		input.title || input.siteTitle,
		CONTENT_WIDTH,
		hasCover ? 3 : 4,
	);
	const titleHeight = Math.max(1, titleLines.length) * TITLE_LINE_HEIGHT;

	const description =
		input.description.trim() !== input.title.trim()
			? input.description.trim()
			: "";
	ctx.font = `400 ${DESCRIPTION_FONT_SIZE}px ${FONT_FAMILY}`;
	const descriptionLines = wrapTextLines(
		ctx,
		description,
		CONTENT_WIDTH,
		hasCover ? 4 : 5,
	);
	const descriptionTop = contentTop + titleHeight + 24;
	const descriptionHeight = descriptionLines.length * DESCRIPTION_LINE_HEIGHT;
	const dividerY = descriptionLines.length
		? descriptionTop + descriptionHeight + 48
		: contentTop + titleHeight + 40;
	const footerY = dividerY + 32;
	const canvasHeight = Math.ceil(footerY + FOOTER_HEIGHT + BOTTOM_PADDING);

	return {
		hasCover,
		headerHeight,
		contentTop,
		titleLines,
		titleHeight,
		descriptionLines,
		descriptionTop,
		descriptionHeight,
		dividerY,
		footerY,
		canvasHeight,
	};
}

function drawBrandBadge(
	ctx: CanvasRenderingContext2D,
	text: string,
	palette: SharePosterPalette,
) {
	ctx.font = `700 26px ${FONT_FAMILY}`;
	const label = text || "Shirone";
	const width = Math.min(ctx.measureText(label).width + 40, 520);
	ctx.fillStyle = palette.primaryContainer;
	drawRoundedRect(ctx, PAGE_PADDING, 40, width, 52, 26);
	ctx.fill();
	ctx.fillStyle = palette.onPrimaryContainer;
	ctx.textBaseline = "middle";
	drawTextEllipsis(ctx, label, PAGE_PADDING + 20, 66, width - 40);
}

function drawCoverHeader(
	ctx: CanvasRenderingContext2D,
	cover: CanvasImageSource,
	input: SharePosterInput,
) {
	drawCoverImage(ctx, cover, 0, 0, SHARE_POSTER_WIDTH, COVER_HEIGHT);
	drawBrandBadge(ctx, input.siteTitle, input.palette);

	ctx.font = `600 25px ${FONT_FAMILY}`;
	const date = input.published || "";
	const badgeWidth = Math.min(ctx.measureText(date).width + 40, 320);
	ctx.fillStyle = input.palette.surfaceContainerLowest;
	drawRoundedRect(ctx, PAGE_PADDING, COVER_HEIGHT - 88, badgeWidth, 56, 16);
	ctx.fill();
	ctx.fillStyle = input.palette.onSurface;
	ctx.textBaseline = "middle";
	drawTextEllipsis(
		ctx,
		date,
		PAGE_PADDING + 20,
		COVER_HEIGHT - 60,
		badgeWidth - 40,
	);
}

function drawNoCoverHeader(
	ctx: CanvasRenderingContext2D,
	input: SharePosterInput,
) {
	const { palette } = input;
	ctx.fillStyle = palette.primaryContainer;
	ctx.fillRect(0, 0, SHARE_POSTER_WIDTH, NO_COVER_HEADER_HEIGHT);

	ctx.fillStyle = palette.primary;
	drawRoundedRect(ctx, PAGE_PADDING, 60, 10, 120, 5);
	ctx.fill();

	ctx.fillStyle = palette.onPrimaryContainer;
	ctx.textBaseline = "top";
	ctx.font = `700 46px ${FONT_FAMILY}`;
	drawTextEllipsis(
		ctx,
		input.siteTitle || "Shirone",
		PAGE_PADDING + 36,
		62,
		CONTENT_WIDTH - 36,
	);
	ctx.font = `400 28px ${FONT_FAMILY}`;
	drawTextEllipsis(
		ctx,
		input.published,
		PAGE_PADDING + 36,
		128,
		CONTENT_WIDTH - 36,
	);
}

function drawArticleContent(
	ctx: CanvasRenderingContext2D,
	input: SharePosterInput,
	layout: PosterLayout,
) {
	const { palette } = input;
	ctx.textBaseline = "top";
	ctx.fillStyle = palette.onSurface;
	ctx.font = `700 ${TITLE_FONT_SIZE}px ${FONT_FAMILY}`;
	layout.titleLines.forEach((line, index) => {
		ctx.fillText(
			line,
			PAGE_PADDING,
			layout.contentTop + index * TITLE_LINE_HEIGHT,
		);
	});

	if (layout.descriptionLines.length > 0) {
		ctx.fillStyle = palette.onSurfaceVariant;
		ctx.font = `400 ${DESCRIPTION_FONT_SIZE}px ${FONT_FAMILY}`;
		layout.descriptionLines.forEach((line, index) => {
			ctx.fillText(
				line,
				PAGE_PADDING,
				layout.descriptionTop + index * DESCRIPTION_LINE_HEIGHT,
			);
		});
	}

	ctx.strokeStyle = palette.outlineVariant;
	ctx.lineWidth = 2;
	ctx.beginPath();
	ctx.moveTo(PAGE_PADDING, layout.dividerY);
	ctx.lineTo(SHARE_POSTER_WIDTH - PAGE_PADDING, layout.dividerY);
	ctx.stroke();
}

function drawAvatar(
	ctx: CanvasRenderingContext2D,
	input: SharePosterInput,
	avatar: CanvasImageSource | null,
	x: number,
	y: number,
	size: number,
) {
	ctx.save();
	ctx.beginPath();
	ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
	ctx.clip();
	if (avatar) {
		drawCoverImage(ctx, avatar, x, y, size, size);
	} else {
		ctx.fillStyle = input.palette.primaryContainer;
		ctx.fillRect(x, y, size, size);
		const initial = segmentText(input.author || "A", "grapheme")[0] || "A";
		ctx.fillStyle = input.palette.onPrimaryContainer;
		ctx.font = `700 42px ${FONT_FAMILY}`;
		ctx.textAlign = "center";
		ctx.textBaseline = "middle";
		ctx.fillText(initial.toUpperCase(), x + size / 2, y + size / 2);
	}
	ctx.restore();
	ctx.textAlign = "left";
}

function drawFooter(
	ctx: CanvasRenderingContext2D,
	input: SharePosterInput,
	layout: PosterLayout,
	avatar: CanvasImageSource | null,
	qrCanvas: HTMLCanvasElement,
) {
	const { palette } = input;
	const avatarSize = 104;
	const avatarX = PAGE_PADDING;
	const avatarY = layout.footerY + 26;
	drawAvatar(ctx, input, avatar, avatarX, avatarY, avatarSize);

	const qrSize = 150;
	const qrX = SHARE_POSTER_WIDTH - PAGE_PADDING - qrSize;
	const qrY = layout.footerY + 10;
	const textX = avatarX + avatarSize + 24;
	const textWidth = qrX - 36 - textX;

	ctx.textBaseline = "top";
	ctx.fillStyle = palette.onSurfaceVariant;
	ctx.font = `400 21px ${FONT_FAMILY}`;
	ctx.fillText(input.labels.author, textX, layout.footerY + 12);
	ctx.fillStyle = palette.onSurface;
	ctx.font = `700 32px ${FONT_FAMILY}`;
	drawTextEllipsis(
		ctx,
		input.author || input.siteTitle,
		textX,
		layout.footerY + 40,
		textWidth,
	);

	ctx.fillStyle = palette.onSurfaceVariant;
	ctx.font = `400 21px ${FONT_FAMILY}`;
	ctx.fillText(input.labels.scanToRead, textX, layout.footerY + 94);
	ctx.fillStyle = palette.onSurface;
	ctx.font = `700 30px ${FONT_FAMILY}`;
	drawTextEllipsis(
		ctx,
		input.siteTitle,
		textX,
		layout.footerY + 122,
		textWidth,
	);

	ctx.fillStyle = "#ffffff";
	drawRoundedRect(ctx, qrX, qrY, qrSize, qrSize, 16);
	ctx.fill();
	ctx.drawImage(qrCanvas, qrX + 7, qrY + 7, qrSize - 14, qrSize - 14);
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
	return new Promise((resolve, reject) => {
		canvas.toBlob((blob) => {
			if (blob) resolve(blob);
			else reject(new Error("Canvas toBlob returned null"));
		}, "image/png");
	});
}

/** 生成宽度固定、内容高度自适应的分享海报。 */
export async function generateSharePoster(
	input: SharePosterInput,
): Promise<Blob> {
	if (input.signal?.aborted) {
		throw new DOMException("Poster generation aborted", "AbortError");
	}

	if (typeof document !== "undefined" && document.fonts) {
		try {
			await document.fonts.ready;
		} catch {
			// 系统字体回退仍可完成绘制。
		}
	}

	const qrcodeModule = await import("qrcode");
	const QRCode =
		(qrcodeModule as unknown as { default: typeof qrcodeModule }).default ||
		qrcodeModule;
	const [coverImage, avatarImage] = await Promise.all([
		loadDrawableImage(input.coverUrl, input.signal),
		loadDrawableImage(input.avatarUrl, input.signal),
	]);

	try {
		if (input.signal?.aborted) {
			throw new DOMException("Poster generation aborted", "AbortError");
		}

		const qrCanvas = document.createElement("canvas");
		await QRCode.toCanvas(qrCanvas, input.url, {
			width: 256,
			margin: 1,
			errorCorrectionLevel: "M",
			color: { dark: "#000000", light: "#ffffff" },
		});

		const canvas = document.createElement("canvas");
		canvas.width = SHARE_POSTER_WIDTH;
		const measureContext = canvas.getContext("2d");
		if (!measureContext) throw new Error("Unable to create 2d canvas context");

		const layout = measurePosterLayout(
			measureContext,
			input,
			Boolean(coverImage),
		);
		canvas.height = layout.canvasHeight;
		const ctx = canvas.getContext("2d");
		if (!ctx) throw new Error("Unable to create 2d canvas context");

		ctx.fillStyle = input.palette.surfaceContainerLowest;
		ctx.fillRect(0, 0, canvas.width, canvas.height);
		if (coverImage) drawCoverHeader(ctx, coverImage.source, input);
		else drawNoCoverHeader(ctx, input);

		drawArticleContent(ctx, input, layout);
		drawFooter(ctx, input, layout, avatarImage?.source || null, qrCanvas);

		return await canvasToBlob(canvas);
	} finally {
		coverImage?.close?.();
		avatarImage?.close?.();
	}
}
