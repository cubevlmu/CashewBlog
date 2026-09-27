# CSS `!important` 使用规范

> 本规则适用于 `src/` 内的 CSS、Stylus、Astro/Svelte scoped style 与 Tailwind important 工具类。
> 目标不是禁止所有 `!important`，而是把它限制在明确的样式所有权边界，避免优先级竞赛。

---

## 1. 基本原则

`!important` 只能表达一项无法由普通级联可靠表达的**所有权契约**，不能用来掩盖选择器、导入顺序或组件 API 的问题。

新增或修改 `!important` 前，按以下顺序处理：

1. 删除重复或错误的上游规则；
2. 修正选择器是否命中，特别是 Astro/Svelte scope、Stylus `&` 拼接和跨组件 `:global()`；
3. 使用组件 prop、variant、CSS 自定义属性或语义 token 暴露覆盖点；
4. 调整现有 cascade layer 或同一所有者内的源码顺序；
5. 使用一个稳定的组件根类提高必要的选择器精确度；
6. 只有前五项都不适用，并且命中下文允许场景时，才使用 `!important`。

禁止为了避免写一个合理的组件选择器而直接添加 `!important`。

---

## 2. 允许使用的场景

### 2.1 覆盖无法控制的第三方或生成样式

适用于 Tailwind Typography、Expressive Code、Fancybox、OverlayScrollbars 等外部库生成的规则，或库写入的内联样式。必须同时满足：

- Shirone 无法在上游源码中修正；
- 覆盖范围限定在拥有该集成的组件根节点内；
- 只覆盖必要属性，不复制整组第三方声明；
- 有浏览器计算样式或 Playwright 回归断言。

```css
/* !important boundary: Typography owns prose image margins; image-grid owns its frame geometry. */
.custom-md .image-grid .image-grid__link > img {
	margin: 0 !important;
}
```

### 2.2 履行明确的组件覆盖 API

调用方通过组件公开的 `class` 扩展点覆盖 Svelte scoped 默认值时，可以使用单个 Tailwind important 工具类，例如 `!hidden` 或 `!flex`。必须满足：

- 组件 API 明确允许调用方覆盖该属性；
- scoped hash 导致普通工具类稳定地无法生效；
- 添加 variant 或 prop 只会制造一次性 API，且没有复用价值；
- important 只出现在调用点，不反向污染组件内部默认样式。

若相同覆盖出现两次及以上，应优先增加正式 prop/variant，而不是继续复制 important 工具类。

### 2.3 强制执行用户偏好或输出介质

无障碍降级与打印输出可以在局部状态根下使用 `!important`，例如强制关闭第三方动画、过渡或隐藏纯交互控件。必须满足：

- 规则位于 `prefers-reduced-motion`、项目的 reduced-motion 根状态或 `@media print` 中；
- 普通级联无法覆盖第三方内联或生成声明；
- 不借机改写与偏好无关的颜色、排版或布局。

### 2.4 临时兼容已发布的外部契约

当 DOM 或 CSS 来自无法同步升级的外部集成时，可用 `!important` 做范围明确的兼容层。必须附带：

- 边界说明注释；
- 对应回归测试；
- 可移除条件或上游版本信息（若已知）。

此场景不适用于 Shirone 自己拥有的组件。

---

## 3. 严禁使用的场景

以下情况不得使用 `!important`：

1. 修复拼错、未命中或作用域错误的选择器；
2. 在同一组件拥有的模板与样式之间解决普通优先级问题；
3. 覆盖设计 token，或硬编码颜色、圆角、阴影、字体、间距和动效；
4. 弥补错误的导入顺序、重复样式文件或循环覆盖；
5. 在 `*`、`html`、`body` 或无组件根限定的宽泛选择器上批量覆盖；
6. 为 hover、active、focus 等普通交互状态制造优先级优势；
7. 在一个声明块中给多个无关属性统一添加 important；
8. 覆盖测试失败或视觉回归，而没有先确认实际计算样式与所有权；
9. 与另一个 `!important` 继续竞赛；出现 important 对 important 时必须重构边界；
10. 复制参考项目的优先级写法，而未验证 Shirone 的 DOM、scope 和 token 契约。

---

## 4. 作用域与注释要求

新增 `!important` 必须使用能够说明所有权的最窄选择器，并在相邻位置写英文边界注释：

```css
/* !important boundary: <external owner>; <Shirone owner and invariant>. */
```

注释必须回答：

- 谁产生了被覆盖的声明；
- Shirone 的哪个组件拥有最终值；
- 为什么普通级联或组件 API 不能可靠表达。

同一注释可以覆盖紧邻的一组同源声明，但不能为整个文件中的 important 提供笼统豁免。历史声明在被修改时必须补齐说明。

---

## 5. 框架专项规则

### Svelte scoped style

- 先检查 template-literal class、`:global()` 和组件根节点是否正确；
- 子组件内部样式由子组件所有，父组件不得用 important 深度穿透；
- 调用方 class 覆盖仅按 §2.2 处理。

### Astro scoped style

- 跨根状态使用 `:global(.dark)` 等正确作用域，不得用 important 修补错误的 scope；
- 全局内容样式放在已有全局样式入口，不在页面里重复覆盖。

### Stylus

- 先检查 `&` 是否意外拼接修饰符与元素名；
- 明暗双值、`unquote()` 和 token 编译问题不得用 important 掩盖。

### Tailwind

- `!utility` 只用于 §2.2 的公开覆盖契约；
- 不得把 important 设为全局 Tailwind 策略；
- 能由项目 token 或现有组件 variant 表达时，禁止使用任意值 important 工具类。

---

## 6. 验证要求

每个新增或修改的 `!important` 至少完成以下验证：

1. 在浏览器中确认目标声明来自哪个样式表、选择器或内联样式；
2. 验证 direct load 与 Swup 客户端导航后的计算样式；
3. UI 变更运行最小 Playwright 片段与相关 a11y 测试；
4. 明暗主题、窄屏和 reduced-motion/print 中与规则相关的状态必须覆盖；
5. 运行 `npx.cmd astro check`、只读 Biome 检查与 `git diff --check`。

测试应断言用户可观察的布局或计算样式，不应只断言源码中存在 `!important`。

---

## 7. 评审清单

评审含 `!important` 的补丁时逐项确认：

- [ ] 冲突来自第三方、生成样式、公开覆盖 API 或用户偏好边界；
- [ ] 已尝试并排除更低成本的级联、scope、token 或组件 API 解法；
- [ ] 选择器限定在最小组件/集成根节点；
- [ ] 只覆盖必要属性；
- [ ] 相邻注释说明双方所有权和必要性；
- [ ] 没有新增 important 对 important 的竞赛；
- [ ] 有对应的浏览器与回归测试证据；
- [ ] 禁用相关可选功能时仍满足零额外负担原则。

任一项不满足时，评审应要求移除 `!important` 并重构样式边界。
