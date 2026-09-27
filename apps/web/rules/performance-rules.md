# 性能开发硬性规则（Performance Hard Rules）

> 本规则是 Shirone 所有后续页面、组件开发与功能迭代必须遵守的硬性红线。

---

## 1. 页面与组件渲染红线

1. **严禁在页面主体容器上使用 `client:only`**
   - 任何页面级组件（如 `FriendSection`, `ProjectSection`, `SkillSection` 等）必须采用 SSR 服务端直出 HTML；
   - 客户端交互使用 `client:visible`（推荐）或 `client:load` 水合；
   - 唯一例外：涉及客户端解密密码学状态的组件（如 `EncryptedContent`）。
2. **纯展示组件零 JS 注入**
   - 没有客户端状态的原子/分子组件，在 Astro 页面中引入时不得添加任何 `client:*` 指令。

---

## 2. 媒体与图片防抖红线

1. **所有图片必须具备稳定几何约束**
   - 必须通过 CSS `aspect-ratio`、显式 `width/height` 或父容器定高锁定尺寸，严禁未定宽高比的裸图导致页面布局跳动。
2. **图片组件优先使用 `ImageWrapper`**
   - 自动享受 Tonal Bloom 色彩占位与平滑淡入；
   - 动态 glob 扫描必须指定具体图片扩展名，禁止通配全目录。

---

## 3. 动效与滚动红线

1. **动效必须走设计令牌**
   - 严禁随意手写 `transition: all 0.3s` 或未定义贝塞尔曲线；
   - 必须使用 `--m3e-duration-*` 与 `--m3e-easing-*`。
2. **全站动效必须支持 `prefers-reduced-motion`**
   - CSS 必须包含 `@media (prefers-reduced-motion: reduce)` 规则；
   - JS/WAAPI 驱动的动画必须先调用 `prefersReducedMotion()` 检查并直接返回终态。

---

## 4. 构建与扩展功能红线

1. **默认保持离线纯净构建**
   - 构建脚本严禁依赖不可靠的外部第三方 API；
   - 字体子集化默认 `allowRemoteText: false`。
2. **可选功能严格遵守「零额外负担」**
   - 关闭配置时：0 外部网络请求、0 额外 DOM 占位、0 主 bundle 体积增加。

---

## 5. 合并前验收

任何涉及页面结构、图片容器、动效或构建配置的改动，提交前必须执行：

```bash
npx.cmd astro check          # 必须 0 errors / 0 warnings
pnpm.cmd fonts:check         # 字体预算检查必须通过
pnpm.cmd run perf:measure    # LCP < 500ms，CLS < 0.05
pnpm.cmd build               # 生产构建成功无异常告警
```
