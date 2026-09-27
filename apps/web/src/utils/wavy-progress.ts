/**
 * M3E WavyProgressIndicator 几何工具（官方移植）：
 * - buildLinearWavePath：线性波浪全宽路径（官方 LinearWavyProgressModifiers 的
 *   fullProgressPath —— 二次贝塞尔逐半波绘制，controlY = height - strokeWidth，
 *   峰值衰减到 stroke 一半，左右各留 2 个波长余量，向下平移到容器中线）。
 * - buildCircularStarPath：圆形 wavy 的「圆 ↔ 星形齿」RoundedPolygon 移植
 *   （androidx.graphics.shapes RoundedPolygon.star + CornerRounding + Morph 近似）。
 * - cubicBezier：官方 MotionTokens 缓动曲线求值（振幅增大 standard / 减小 emphasized-accelerate）。
 */

type Pt = { x: number; y: number };
type Cubic = {
	x0: number;
	y0: number;
	c0x: number;
	c0y: number;
	c1x: number;
	c1y: number;
	x1: number;
	y1: number;
};

const EPS = 1e-4;

const dist = (x: number, y: number): number => Math.sqrt(x * x + y * y);
const sub = (a: Pt, b: Pt): Pt => ({ x: a.x - b.x, y: a.y - b.y });
const add = (a: Pt, b: Pt): Pt => ({ x: a.x + b.x, y: a.y + b.y });
const scl = (a: Pt, s: number): Pt => ({ x: a.x * s, y: a.y * s });
const dot = (a: Pt, b: Pt): number => a.x * b.x + a.y * b.y;
const rot90 = (a: Pt): Pt => ({ x: -a.y, y: a.x });
const dirv = (x: number, y: number): Pt => {
	const d = dist(x, y);
	return { x: x / d, y: y / d };
};
const lerp = (a: number, b: number, t: number): number => (1 - t) * a + t * b;

function cubicLine(x0: number, y0: number, x1: number, y1: number): Cubic {
	return {
		x0,
		y0,
		c0x: lerp(x0, x1, 1 / 3),
		c0y: lerp(y0, y1, 1 / 3),
		c1x: lerp(x0, x1, 2 / 3),
		c1y: lerp(y0, y1, 2 / 3),
		x1,
		y1,
	};
}

function cubicArc(
	cx: number,
	cy: number,
	x0: number,
	y0: number,
	x1: number,
	y1: number,
): Cubic {
	const p0d = dirv(x0 - cx, y0 - cy);
	const p1d = dirv(x1 - cx, y1 - cy);
	const rp0 = rot90(p0d);
	const rp1 = rot90(p1d);
	const clockwise = dot(rp0, { x: x1 - cx, y: y1 - cy }) >= 0;
	const cosa = dot(p0d, p1d);
	if (cosa > 0.999) return cubicLine(x0, y0, x1, y1);
	const k =
		((dist(x0 - cx, y0 - cy) *
			(4 / 3) *
			(Math.sqrt(2 * (1 - cosa)) - Math.sqrt(1 - cosa * cosa))) /
			(1 - cosa)) *
		(clockwise ? 1 : -1);
	return {
		x0,
		y0,
		c0x: x0 + rp0.x * k,
		c0y: y0 + rp0.y * k,
		c1x: x1 - rp1.x * k,
		c1y: y1 - rp1.y * k,
		x1,
		y1,
	};
}

function reverseCubic(c: Cubic): Cubic {
	return {
		x0: c.x1,
		y0: c.y1,
		c0x: c.c1x,
		c0y: c.c1y,
		c1x: c.c0x,
		c1y: c.c0y,
		x1: c.x0,
		y1: c.y0,
	};
}

function lineIntersection(p0: Pt, d0: Pt, p1: Pt, d1: Pt): Pt | null {
	const rp1 = rot90(d1);
	const den = dot(d0, rp1);
	if (Math.abs(den) < EPS) return null;
	const num = dot(sub(p1, p0), rp1);
	if (Math.abs(den) < EPS * Math.abs(num)) return null;
	const k = num / den;
	return add(p0, scl(d0, k));
}

/** 单个角的圆化（官方 RoundedCorner 移植）：返回该角的贝塞尔段集合。 */
interface CornerResult {
	expectedRoundCut: number;
	expectedCut: number;
	getCubics(allowedCut0: number, allowedCut1: number): Cubic[];
}

function roundedCorner(
	p0: Pt,
	p1: Pt,
	p2: Pt,
	radius: number,
	smoothing: number,
): CornerResult {
	const v01 = sub(p0, p1);
	const v21 = sub(p2, p1);
	const d01 = dist(v01.x, v01.y);
	const d21 = dist(v21.x, v21.y);
	if (d01 <= 0 || d21 <= 0) {
		return {
			expectedRoundCut: 0,
			expectedCut: 0,
			getCubics: () => [cubicLine(p1.x, p1.y, p1.x, p1.y)],
		};
	}
	const d1 = scl(v01, 1 / d01);
	const d2 = scl(v21, 1 / d21);
	const cosAngle = dot(d1, d2);
	const sinAngle = Math.sqrt(1 - cosAngle * cosAngle);
	const expectedRoundCut =
		sinAngle > 1e-3 ? (radius * (cosAngle + 1)) / sinAngle : 0;
	const expectedCut = (1 + smoothing) * expectedRoundCut;

	const calcSmoothing = (allowedCut: number): number => {
		if (allowedCut > expectedCut) return smoothing;
		if (allowedCut > expectedRoundCut) {
			return (
				(smoothing * (allowedCut - expectedRoundCut)) /
				(expectedCut - expectedRoundCut)
			);
		}
		return 0;
	};

	const flanking = (
		actualRoundCut: number,
		smoothingValue: number,
		sideStart: Pt,
		circleHit: Pt,
		otherCircleHit: Pt,
		center: Pt,
		actualR: number,
	): Cubic => {
		const sideDir = dirv(sideStart.x - p1.x, sideStart.y - p1.y);
		const curveStart = add(
			p1,
			scl(sideDir, actualRoundCut * (1 + smoothingValue)),
		);
		const mid = scl(add(circleHit, otherCircleHit), 0.5);
		const p = add(scl(circleHit, 1 - smoothingValue), scl(mid, smoothingValue));
		const curveEnd = add(
			center,
			scl(dirv(p.x - center.x, p.y - center.y), actualR),
		);
		const tangent = rot90(sub(curveEnd, center));
		const anchorEnd =
			lineIntersection(sideStart, sideDir, curveEnd, tangent) ?? circleHit;
		const anchorStart = scl(add(curveStart, scl(anchorEnd, 2)), 1 / 3);
		return {
			x0: curveStart.x,
			y0: curveStart.y,
			c0x: anchorStart.x,
			c0y: anchorStart.y,
			c1x: anchorEnd.x,
			c1y: anchorEnd.y,
			x1: curveEnd.x,
			y1: curveEnd.y,
		};
	};

	return {
		expectedRoundCut,
		expectedCut,
		getCubics(allowedCut0: number, allowedCut1: number): Cubic[] {
			const allowedCut = Math.min(allowedCut0, allowedCut1);
			if (expectedRoundCut < EPS || allowedCut < EPS || radius < EPS) {
				return [cubicLine(p1.x, p1.y, p1.x, p1.y)];
			}
			const actualRoundCut = Math.min(allowedCut, expectedRoundCut);
			const s0 = calcSmoothing(allowedCut0);
			const s1 = calcSmoothing(allowedCut1);
			const actualR = (radius * actualRoundCut) / expectedRoundCut;
			const centerDist = Math.sqrt(
				actualR * actualR + actualRoundCut * actualRoundCut,
			);
			const center = add(p1, scl(dirv(d1.x + d2.x, d1.y + d2.y), centerDist));
			const hit0 = add(p1, scl(d1, actualRoundCut));
			const hit2 = add(p1, scl(d2, actualRoundCut));
			const f0 = flanking(actualRoundCut, s0, p0, hit0, hit2, center, actualR);
			const f2 = reverseCubic(
				flanking(actualRoundCut, s1, p2, hit2, hit0, center, actualR),
			);
			return [f0, cubicArc(center.x, center.y, f0.x1, f0.y1, f2.x0, f2.y0), f2];
		},
	};
}

const fmt = (v: number): string => (Math.round(v * 100) / 100).toString();

/**
 * 线性波浪全宽路径（max-amplitude 空间，已居中到 height/2）。
 * 官方：M0,0 → 每半波一个 quadraticTo(controlX, controlY, anchorX, 0)，
 * controlY = (height - strokeWidth) * amplitude（amplitude 0..1：0 = 直线居中，1 = 满波），
 * 再 translate(0, height/2) 居中。pathWidth 需含左右 2 个波长余量。
 */
export function buildLinearWavePath(
	pathWidth: number,
	wavelength: number,
	height: number,
	strokeWidth: number,
	amplitude = 1,
	startX = 0,
): string {
	const halfWavelength = wavelength / 2;
	const controlY = (height - strokeWidth) * amplitude;
	let d = `M ${fmt(startX)} ${fmt(height / 2)}`;
	let anchorX = startX + halfWavelength;
	let controlX = startX + halfWavelength / 2;
	const halfWavesFromZero = Math.round(startX / halfWavelength);
	let cy = halfWavesFromZero % 2 === 0 ? controlY : -controlY;
	while (anchorX <= pathWidth) {
		d += ` Q ${fmt(controlX)} ${fmt(height / 2 + cy)}, ${fmt(anchorX)} ${fmt(height / 2)}`;
		anchorX += halfWavelength;
		controlX += halfWavelength;
		cy *= -1;
	}
	return d;
}

export interface CircularStarOptions {
	/** 顶点数（每半径，官方 numVertices = max(5, round(2πr/wavelength))） */
	numVertices: number;
	/** 内半径比例（官方 0.75） */
	innerRadius: number;
	/** 外角圆化半径（官方 0.35） */
	outerRounding: number;
	/** 外角 smoothing（官方 0.4） */
	outerSmoothing: number;
	/** 内角圆化半径（官方 0.5） */
	innerRounding: number;
	/** 外半径 px（官方 (size - strokeWidth) / 2） */
	radius: number;
	cx: number;
	cy: number;
	/** 0..1：0 = 圆（Morph 起点），1 = 满星 */
	amplitude: number;
}

/**
 * 圆 ↔ 星形齿 morph 路径（官方 RoundedPolygon.star + Morph 移植）：
 * 顶点外/内交替从 0°（3 点钟）开始；振幅插值时内外半径按 amplitude 插值
 * （等价官方 Morph 在 track 圆与 star 之间插值），角圆化参数固定。
 */
export function buildCircularStarPath(opts: CircularStarOptions): string {
	const {
		numVertices: n,
		innerRadius,
		outerRounding,
		outerSmoothing,
		innerRounding,
		radius,
		cx,
		cy,
	} = opts;
	const amplitude = Math.max(0, Math.min(1, opts.amplitude));
	const innerR = 1 - amplitude * (1 - innerRadius);
	const verts: Pt[] = [];
	for (let i = 0; i < n; i++) {
		const ao = ((2 * Math.PI) / n) * i;
		verts.push({
			x: cx + Math.cos(ao) * radius,
			y: cy + Math.sin(ao) * radius,
		});
		const ai = ((2 * Math.PI) / n) * (i + 0.5);
		verts.push({
			x: cx + Math.cos(ai) * radius * innerR,
			y: cy + Math.sin(ai) * radius * innerR,
		});
	}
	const total = n * 2;
	const corners = verts.map((v, i) => {
		const prev = verts[(i + total - 1) % total];
		const next = verts[(i + 1) % total];
		const isOuter = i % 2 === 0;
		return roundedCorner(
			prev,
			v,
			next,
			(isOuter ? outerRounding : innerRounding) * radius,
			isOuter ? outerSmoothing : 0,
		);
	});
	// 每条边能切多少（先保证圆化，再分配 smoothing 空间，官方 cutAdjusts）
	const cutAdjusts: Array<[number, number]> = [];
	for (let i = 0; i < total; i++) {
		const rc =
			corners[i].expectedRoundCut + corners[(i + 1) % total].expectedRoundCut;
		const ec = corners[i].expectedCut + corners[(i + 1) % total].expectedCut;
		const sideSize = dist(
			verts[i].x - verts[(i + 1) % total].x,
			verts[i].y - verts[(i + 1) % total].y,
		);
		if (rc > sideSize) cutAdjusts.push([sideSize / rc, 0]);
		else if (ec > sideSize) cutAdjusts.push([1, (sideSize - rc) / (ec - rc)]);
		else cutAdjusts.push([1, 1]);
	}
	const cornerCubics = corners.map((c, i) => {
		const a0 =
			c.expectedRoundCut * cutAdjusts[(i + total - 1) % total][0] +
			(c.expectedCut - c.expectedRoundCut) *
				cutAdjusts[(i + total - 1) % total][1];
		const a1 =
			c.expectedRoundCut * cutAdjusts[i][0] +
			(c.expectedCut - c.expectedRoundCut) * cutAdjusts[i][1];
		return c.getCubics(a0, a1);
	});
	let d = "";
	for (let i = 0; i < total; i++) {
		for (const c of cornerCubics[i]) {
			if (!d) d = `M ${fmt(c.x0)} ${fmt(c.y0)}`;
			d += ` C ${fmt(c.c0x)} ${fmt(c.c0y)}, ${fmt(c.c1x)} ${fmt(c.c1y)}, ${fmt(c.x1)} ${fmt(c.y1)}`;
		}
		const nextFirst = cornerCubics[(i + 1) % total][0];
		d += ` L ${fmt(nextFirst.x0)} ${fmt(nextFirst.y0)}`;
	}
	d += " Z";
	return d;
}

/** 官方圆形顶点数：max(5, round(2πr / wavelength))，r = 容器/2 - stroke/2。 */
export function circularWavyVertexCount(
	size: number,
	strokeWidth: number,
	wavelength: number,
): number {
	const r = size / 2 - strokeWidth / 2;
	return Math.max(5, Math.round((2 * Math.PI * r) / wavelength));
}

/** 官方 cubic-bezier 缓动求值（MotionTokens.Easing*）。 */
function bez(t: number, a: number, b: number): number {
	return 3 * (1 - t) * (1 - t) * t * a + 3 * (1 - t) * t * t * b + t * t * t;
}

export function cubicBezier(
	x1: number,
	y1: number,
	x2: number,
	y2: number,
): (t: number) => number {
	return (t: number): number => {
		if (t <= 0) return 0;
		if (t >= 1) return 1;
		let u = t;
		for (let i = 0; i < 8; i++) {
			const x = bez(u, x1, x2);
			const err = x - t;
			if (Math.abs(err) < 1e-6) break;
			const dx =
				3 * (1 - u) * (1 - u) * x1 +
				6 * (1 - u) * u * (x2 - x1) +
				3 * u * u * (1 - x2);
			u = Math.max(0, Math.min(1, u - err / dx));
		}
		return bez(u, y1, y2);
	};
}
