---
name: shirone-markdown-dev
description: Developing custom Markdown syntaxes and remark/rehype plugins for the Shirone theme - plugin ownership boundaries, registration order, syntax manifest, content-driven on-demand loading, npm integration sync, and tests. Use when adding or changing Markdown extensions, prose plugins, generated component styles, or package-mode wiring.
---

# Shirone Markdown 扩展开发

`src/utils/markdown-processor.mjs` 是站点 Markdown 插件链的单一事实来源,Astro 页面渲染与构建期离线渲染共用同一组 `siteRemarkPlugins`/`siteRehypePlugins`。新增或修改语法前,先读完四份 Markdown 规范(见下)。

## 核心红线

1. **所有权边界**:语法解析(`src/plugins/markdown/` 下 remark 插件)→ DOM 生成(rehype 插件)→ 可复用核心(`core/` 纯函数)→ 组件样式(`src/styles/markdown/`)→ 样式入口(`src/styles/markdown.css`),各层不得越权;插件注册顺序与阶段依赖以 `docs/markdown-plugin-order.md` 为准。
2. **Typography 边界**:正文型扩展留在 `.prose` 下;完整小组件根节点必须加 `not-prose` 并自持内部几何。冲突时优先修正所有权与样式入口,不用 `!important` 或堆叠选择器掩盖(边界见 `rules/css-important.md`)。
3. **内容驱动按需加载**:作者只写 Markdown,**不得**为启用语法引入 frontmatter 开关或全局配置;特征只能由处理链从成功解析的内容生成。未命中语法时零 CSS/JS 请求、零增强 DOM、零监听器。页面级 CSS 必须由 `<head>` 条件样式包声明——动态 `import("x.css")` 只能做到首次命中加载,Vite 注入的样式不会随 Swup 离开页面移除。
4. **SSR 优先**:能用原生 HTML(`<details>`/`<summary>`、`<mark>`、`<abbr>`)表达的交互不加 hydration;`client-enhanced` 语法的初始 HTML 必须完整可读,脚本失败不能丢正文;客户端初始化必须覆盖直接加载、Swup `content:replace` 与文章解密三条路径。
5. **非法输入保留原文**:不完整的语法回退为普通 Markdown,不静默改写。
6. **manifest 登记**:语法在生产可用后才加入 `src/plugins/markdown/manifest.json`(按 `id` 排序),演示文章、实现、样式、测试路径必须真实存在;`research/` 里的候选能力不得提前登记。插件/样式/演示/测试移动时同一提交更新 manifest。

## 新语法准入流程(摘要)

独立演示文章定义真实场景 → 固定作者输入/AST/DOM/回退/SSR 行为 → 在 `markdown-processor.mjs` 注册(Expressive Code 集成走 `astro.config.mjs`)→ 实现 + 样式 + 单元测试(`tests/plugins/`)+ 页面测试(`tests/site/`)+ 作者文档 → 登记 manifest → 跑校验。

## 必读文档

- `docs/markdown-extensions.md` — 处理链所有权、Typography 边界、样式入口、缓存与验证契约
- `docs/markdown-plugin-order.md` — 插件注册顺序与阶段依赖(权威)
- `docs/markdown-syntax-manifest.md` — manifest 字段契约、状态含义、准入/退役流程
- `docs/markdown-on-demand-loading.md` — 内容特征探测、条件样式包、动态运行时、Swup 资源生命周期
- `src/utils/markdown-processor.mjs` — 插件链单一注册入口
- `src/plugins/markdown/manifest.json` — 作者语法机器可读单一索引
- `rules/pitfalls.md` — 相关缓存与集成踩坑

## 验证命令

`pnpm.cmd check:markdown-manifest` → `pnpm.cmd check:manifest` → `node --test tests/plugins`(递归运行对应插件单测)→ 最小 `tests/site/<spec>.spec.ts` + `tests/site/a11y.spec.ts` → `npx.cmd astro check` → `pnpm.cmd build`。变更陈旧时清 `.astro/data-store.json` 重启。

## npm 包兼容性

Markdown 语法和样式修改必须能被包模式 integration 发现。新增语法和 stylesheet pack 时登记到 `src/plugins/markdown/manifest.json`，并在 `shirones` 打包仓库同步处理示例内容 rewrite。修改路径或 integration wiring 前阅读 `docs/npm-package-mode.md`、`docs/packaging-contract.md` 和 `rules/project-rules.md` 第 12 节。
