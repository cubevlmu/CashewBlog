/**
 * 配置反向差分：求出「用户必须写在内容仓 YAML 里的最小覆盖集」。
 *
 * 这是 `src/utils/config-overlay.ts` 里 `deepMerge` 的**精确逆运算**：
 *
 * ```text
 * deepMerge(defaults, diffConfig(defaults, effective)) ≡ effective
 * ```
 *
 * 因此规则必须与 `deepMerge` 逐条对应：
 *
 * | 情形 | deepMerge | diffConfig |
 * | --- | --- | --- |
 * | 两侧深相等 | 覆盖值等于默认值，写不写都一样 | **省略**（不写这个键） |
 * | 任一侧是数组且不相等 | 整体替换 | 整体写出 `effective` 的数组，不逐项 diff |
 * | 两侧都是纯对象 | 逐键递归合并 | 逐键递归，收集非空结果 |
 * | 其余（标量 / 类型不同） | 整体替换 | 写出 `effective` |
 *
 * 数组之所以不逐项 diff，是因为合并侧的语义就是整体替换：
 * `sidebar.components`、`profile.links` 这类清单只有「这就是我要的全部条目」一种含义，
 * 逐项 diff 出来的结果喂回深合并会得到完全不同的数组。
 *
 * 差分只处理 JSON 可表达的值。各配置领域的生效值树在 `config-introspect.mjs` 里
 * 已经过 `JSON.parse(JSON.stringify(...))` 归一化，不会出现 function / undefined / Date。
 */

/** 表示「这个键不需要写进 YAML」。用哨兵而不是 `undefined`，避免与合法的空值混淆。 */
export const OMIT = Symbol("shirone.config-diff.omit");

/** 判断是否是纯对象（排除数组与 class 实例，与 `deepMerge` 的 `isPlainObject` 同义）。 */
export function isPlainObject(value) {
	if (typeof value !== "object" || value === null || Array.isArray(value)) {
		return false;
	}
	const prototype = Object.getPrototypeOf(value);
	return prototype === Object.prototype || prototype === null;
}

/** JSON 值的深相等。键顺序无关：YAML 里的键顺序不构成语义差异。 */
export function deepEqual(a, b) {
	if (a === b) return true;
	if (Array.isArray(a) || Array.isArray(b)) {
		if (!Array.isArray(a) || !Array.isArray(b)) return false;
		if (a.length !== b.length) return false;
		return a.every((item, index) => deepEqual(item, b[index]));
	}
	if (isPlainObject(a) && isPlainObject(b)) {
		const keys = Object.keys(a);
		if (keys.length !== Object.keys(b).length) return false;
		return keys.every(
			(key) => Object.hasOwn(b, key) && deepEqual(a[key], b[key]),
		);
	}
	return false;
}

/**
 * 求「默认值 → 生效值」的最小覆盖集。
 *
 * @param {unknown} defaults 主题默认值（不含任何用户覆盖）
 * @param {unknown} effective 当前生效值（默认值 ⊕ 用户覆盖）
 * @param {{ unrepresentable?: string[], path?: string }} [report]
 *   收集**无法用深合并表达**的差异，供调用方告警。目前只有一种：
 *   默认值里有某个键、生效值里却没有——深合并只能新增和替换，不能删除键。
 * @returns {unknown | typeof OMIT} 需要写进 YAML 的值，或 `OMIT` 表示无需写出
 */
export function diffConfig(defaults, effective, report) {
	if (deepEqual(defaults, effective)) return OMIT;

	// 数组整体替换：任一侧是数组且两者不相等，就写出完整的 effective 数组。
	if (Array.isArray(defaults) || Array.isArray(effective)) return effective;

	if (isPlainObject(defaults) && isPlainObject(effective)) {
		const result = {};
		for (const [key, value] of Object.entries(effective)) {
			const nested = diffConfig(
				Object.hasOwn(defaults, key) ? defaults[key] : undefined,
				value,
				report && { ...report, path: joinPath(report.path, key) },
			);
			if (nested !== OMIT) result[key] = nested;
		}

		// 默认值有、生效值没有的键：深合并无法表达「删除」，只能告警。
		if (report?.unrepresentable) {
			for (const key of Object.keys(defaults)) {
				if (Object.hasOwn(effective, key)) continue;
				report.unrepresentable.push(joinPath(report.path, key));
			}
		}

		// 递归后可能一个键都没剩（例如两侧只差一个「默认值独有」的键）。
		return Object.keys(result).length === 0 ? OMIT : result;
	}

	// 标量、null，或两侧类型不同：整体写出。
	return effective;
}

function joinPath(prefix, key) {
	return prefix ? `${prefix}.${key}` : key;
}

/**
 * 把覆盖集摊平成「叶子路径 -> 值」，供 `yaml` 的 `setIn` 逐键写入。
 *
 * 叶子的定义与差分规则一致：标量与数组都是叶子（数组整体替换，不下钻），
 * 只有纯对象才继续展开。逐叶子写入而不是整棵子树替换，
 * 是为了让用户已有 YAML 里的注释与格式尽可能原地保留。
 *
 * @param {unknown} override `diffConfig` 的结果
 * @returns {{path: (string|number)[], value: unknown}[]}
 */
export function flattenOverride(override) {
	const leaves = [];
	const walk = (value, path) => {
		if (isPlainObject(value) && Object.keys(value).length > 0) {
			for (const [key, item] of Object.entries(value)) {
				walk(item, [...path, key]);
			}
			return;
		}
		leaves.push({ path, value });
	};
	walk(override, []);
	return leaves;
}
