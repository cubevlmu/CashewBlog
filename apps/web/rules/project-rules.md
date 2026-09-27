# 项目规则

> Shirone 项目的硬性约定与工作流。新增代码前必读。
> 配套文档：`rules/pitfalls.md`（踩坑）、`rules/css-important.md`（CSS `!important` 使用规范）、`rules/component-api.md`（组件 API 规范）、`rules/a11y.md`（无障碍与键盘交互）、`rules/visual-regression.md`（视觉回归）、`rules/ai-skills.md`（AI skills 维护）、`docs/ai-skills-maintenance.md`（skills 操作手册）、`docs/m3e-standard.md`（组件标准）、`docs/atomic-structure.md`（分层规范）、`docs/markdown-extensions.md`（Markdown 插件、样式与缓存契约）、`docs/performance-guidelines.md`（性能架构指南）、`rules/performance-rules.md`（性能开发硬性规则）。

---

## 1. 项目定位

Shirone = 「偏二次元风的 M3E（Material 3 Expressive）主题」博客。

- **M3E 是工程骨架与交互语言**：HCT 动态配色、状态层、动效 token、无障碍。
- **二次元是皮肤与气质**：圆润形状、萌系字体、主题壁纸（后期接入）。
- 参考项目：Fuwari（继承基底），二次元视觉与配置化结构参照见 `research/blog-design-plan.md`。

长期设计方向见 `research/blog-design-plan.md`（本地调查文档，不入库）。

---

## 2. 目标

持续把博客 UI 收敛到自研 M3E 原子组件库：

- 组件按 M3 分类（action / selection / input / navigation / overlay / feedback / display / blog）；
- token 驱动、深浅色自适应；
- 无障碍（axe）+ 键盘交互达标；
- Playwright 锁定行为；
- 最终让博客全部页面由原子层驱动。

---

## 3. 分层结构

```
atoms/ → molecules/ → organisms/ → layouts/ → pages/
   ▲ 依赖方向：只允许向上引用
system/（全局基础设施，仅 layouts 引用）
content/（Markdown 正文，仅 pages 引用）
```

- 跨目录引用一律 `@components/<层>/<文件>`，禁止 `../../` 相对链。
- 禁止恢复 `control/`、`misc/`、`widget/` 历史遗留目录。
- 组件命名 PascalCase。
- 详见 `docs/atomic-structure.md`。

---

## 4. 原子组件约定

新原子必须满足以下约定。**落地驱动**：先确认有页面需要、现有原子组合不了，才新建（详见 `research/m3e-landing-design.md`）；无落地目标的组件进 wishlist，不写代码。

1. **数据驱动**：对外最小 props 集，展示数据由调用方传入；
2. **token 对齐**：颜色用 `--primary` / `--surface-container-*` / `--shape-corner-*`，字体用 `--m3e-type-*`，动效用 `--m3e-duration-*` + `--m3e-easing-*`；
3. **交互反馈**：hover/focus/pressed 叠色统一用 `.m3-state-layer`，不自造 `:hover { background: ... }`；
4. **演示页 + 测试**：补 `*Demo.svelte`（演示页不入库）+ `tests/atoms/*.spec.ts`，并加入 a11y 扫描清单（Tier C 组件不做测试）；※ 当前 atoms 级测试体系已移除（2026-08，测试页/spec 删除、组件保留），落地组件时按 `docs/m3e-standard.md` §9 约定重建；
5. **清单登记 + 文档标注**：在 `src/components/atoms/manifest.json` 登记 `{name,file,category,tier,source,landed,note}`，并在 `docs/m3e-standard.md` §4 清单标注「移植 / 原创」来源；
6. **官方对齐**：移植官方 M3/Compose/Material Web 时，行为/视觉对齐官方 token（参考 `research/material-web/tokens/versions/v0_192`）；
7. **形状契约**：按钮/卡片/输入框/浮层圆角遵循 `docs/m3e-standard.md` §3.2 形状契约表。

静态原子用 Astro，交互原子用 Svelte 5（runes 或 legacy `$:` 均可，同文件内不混用）。

---

## 5. 提交约定

- **提交信息风格**：`fix(scope):` / `feat(scope):` / `test(scope):` / `docs(scope):` / `refactor(scope):`，body 用**英语**，不带专项字母（如 E/F）。
- **绝不提交演示页**：`src/components/atoms/*Demo.svelte`、`src/pages/atoms-*-test.astro`、`BlogDemo/DisplayDemo` 仅本地验证用。
- **提交命令**：`git add -u`（只暂存已跟踪文件）+ 显式 `git add <新原子文件>`，绝不 `git add -A`（会把演示页/临时文件带进去）。
- **提交前确认**：提交前先向用户确认，不擅自提交。
- 提交信息用英语；含引号等特殊字符时写临时文件 `git commit -F`（见 `rules/pitfalls.md` §6.1）。

---

## 6. 代码风格与格式化

- **强制 Biome 格式化**：提交代码前**必须**运行 `pnpm format` 格式化所有代码文件，确保全仓代码缩进（tab）、引号（double）及导入顺序完全统一；CI 环境下执行 `pnpm exec biome ci ./src` 进行零写入校验。
- **禁止硬编码**：色值、圆角、阴影、动效时长一律走 token（唯一例外：图片上的覆盖层用固定黑/白）。
- **禁止散落的非令牌动效**：如 `transition: all 0.3s`、`animation: xxx 1s linear`。
- **限制 `!important`**：仅允许用于不可控第三方/生成样式、明确的组件覆盖 API 或用户偏好边界，并遵循 `rules/css-important.md` 的作用域、注释和测试要求。
- **禁止原子/分子引入业务副作用**：数据获取、localStorage、路由跳转属于有机体。

---

## 7. 零额外负担原则（Zero Burden / Zero Cost when Disabled）

任何可选特性、侧栏 widget、第三方服务（如评论、统计等）或可配置能力必须遵循「安全默认、关闭零开销」：

1. **零外部网络请求**：在未开启或文章禁用时，严禁产生外部网络请求（不预拉取、不加载任何第三方 script/link/font/iframe）；
2. **零 DOM 污染与布局偏移**：关闭时完全不输出占位 DOM、空卡片或额外 margin/padding，保持存量页面的 DOM 结构、性能与视觉快照基线 100% 不变；
3. **零 npm Bundle 膨胀**：可选的第三方依赖与 SDK 严禁打包进主 npm bundle，必须通过按需/运行时动态加载机制（如 script loader）引入；
4. **存量数据平滑兼容**：Markdown frontmatter 等内容 Schema 必须提供安全默认值（如 `comment: true` 默认继承全局），禁止强制要求批量改写存量文章数据。

> 落地做法与验证方法（含 Astro CSS 提升陷阱）见 `docs/on-demand-loading.md`。

---

## 8. 质量闸门

提交前必须全绿：

```bash
pnpm.cmd format              # 强制代码格式化
npx.cmd astro check          # 0 errors / 0 warnings
node scripts/check-manifest.mjs  # manifest 与文件系统一致
npx.cmd playwright test      # site 级全量测试
```

测试覆盖（`tests/`）：
- `tests/site/`：视觉回归（4 页面 × light/dark）、axe 双模式（真实页面）、TOC、文章页、SSR 图标渲染、reduced-motion；

---

## 9. 环境与命令

- 系统 PowerShell，禁脚本执行：一律用 `npx.cmd` / `npm.cmd` / `pnpm.cmd`。
- `pnpm.cmd dev` 起 Astro dev（端口 4321）。
- 测试用 `npx.cmd playwright test`（单 worker，`reuseExistingServer`）。
- 运行测试 / astro check 需要写 node_modules 缓存。

---

## 10. 视觉样式原则（后续接入时）

1. 装饰层与组件层物理隔离（`features/` 层，默认关闭、零开销）；
2. 装饰必须尊重 `prefers-reduced-motion`；
3. 装饰色值 token 化，跟随主题色相，不写死粉色；
4. 最小补丁 + 高性能，不引入重依赖。

详见 `research/blog-design-plan.md` §4 / §11。

---

## 11. 性能架构与设计准则

所有新增页面、组件和功能必须遵循 `docs/performance-guidelines.md` 与 `rules/performance-rules.md`：

1. **SSR-First 内容直出**：页面主体必须在服务端生成完整静态 HTML，严禁在页面级容器滥用 `client:only`；
2. **图片与布局防抖**：所有图片容器必须预设稳定宽高比或尺寸，接入 Tonal Bloom 色调辉光占位，消除 CLS 布局偏移；
3. **动效自律与平衡**：全站过渡必须走 M3E 动效令牌，兼顾切页平滑滚动与高帧率，严格支持 `prefers-reduced-motion` 降级；
4. **零额外负担与纯净构建**：可选功能关闭时 0 DOM / 0 请求 / 0 bundle 增加，构建期零外部网络强依赖；
5. **量化验证**：改动后执行 `pnpm.cmd run perf:measure`，确保 LCP < 500ms、CLS < 0.05。

---

## 12. 运行时数据契约（Astro SSR ↔ CashewBlog API）

公共站点是 Astro SSR（`output: "server"`，Node standalone），所有内容与站点设置在请求时来自 ASP.NET API。

1. **取数只走 `src/lib/api/`**：组件与页面不直接 `fetch()`；请求级客户端在 `Astro.locals.api`，站点设置派生的上下文在 `Astro.locals.site`（`src/lib/site/context.ts`，由 `src/middleware.ts` 挂载）。DTO 与仓库根 `docs/api.md` 保持一致。
2. **管理员设置不进 `src/config/`**：站点标题、主题色、横幅、导航、侧栏、公告、页脚、Umami 等只能从 `Astro.locals.site` 读取；`src/config/` 只保留开发者决定的静态配置（FAB、右键菜单、图片光晕、代码块主题、字体、集成选项）。
3. **客户端不持有设置副本**：客户端脚本需要的外观值由 `ConfigCarrier` / `<html>` data 属性下发。
4. **Markdown 在运行时渲染**：正文由 `src/lib/markdown/render.ts` 渲染，复用 `markdown-processor.mjs` 的插件链与 `ec.config.mjs` 的 Expressive Code 配置；新增语法仍需登记 `src/plugins/markdown/manifest.json`。Markdown 插件不得读取服务器文件系统（正文来自数据库）。
5. **私密内容**：非 Published 的文章响应必须 `Cache-Control: private, no-store` 且 `noindex`；列表、RSS、sitemap、搜索只含公开内容（由后端保证，前端不得绕过）。
6. **降级**：bootstrap 不可用时渲染默认设置，内容请求失败走 `500.astro`，不输出堆栈。
