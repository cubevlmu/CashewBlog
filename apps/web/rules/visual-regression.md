# 视觉回归管理规范

> Shirone 真实页面的视觉回归（黄金截图）约定。
> 锁定首页 / 归档 / 关于 / 文章页在 light/dark 双模式下的布局、圆角、阴影。
> 配套：`tests/site/visual.spec.ts`、`playwright.config.ts`。

---

## 1. 目标

- 锁定真实页面的**整体视觉基线**：布局、圆角、阴影、间距；
- 与 token 断言互补：token 断言证明「样式值算得对」，视觉回归证明「看起来对」；
- 捕获 token 断言抓不到的回归：布局塌陷、间距失衡、溢出换行错位。

---

## 2. 截图范围

4 个真实页面 × light/dark 双模式 = 8 张黄金图：

| 页面 | 路径 | 覆盖 |
|---|---|---|
| 首页 | `/` | Navbar + SideBar + PostCard 列表 + Footer |
| 归档 | `/archive/` | ArchivePanel（ArchiveList 时间轴） |
| 关于 | `/about/` | Card + Markdown（含 GitHub 卡片） |
| 文章页 | `/posts/guide/` | 标题 AccentBar + PostMeta + 正文 + prev/next |

---

## 3. 确定性保证（防 flaky）

截图前必须：

1. **折叠动效**：`page.emulateMedia({ reducedMotion: "reduce" })`——把 onload/主题过渡折叠为 0.01ms，保证每次渲染到相同最终态（最终态 opacity 1 / transform none，与正常渲染视觉一致）；
2. **mock 外部 API**：GitHub 卡片 `page.route("https://api.github.com/**")` 返回固定响应，避免限流导致骨架屏抖动；
3. **等待主题初始化**：等 `--mc-primary` 写入 `:root`；
4. **等待动画收敛**：等 `.onload-animation` 全部 opacity 1（跳过 display:none 元素）；
5. **固定 viewport**：1280×900（`playwright.config.ts` 全局默认）。

---

## 4. 黄金图管理

- 存放路径：`tests/site/visual.spec.ts-snapshots/`（由 `snapshotPathTemplate` 固定，去掉 `-win32` 平台后缀）；
- **不入库**：`.gitignore` 已忽略该目录（黄金图是本地基线，随环境生成）；
- 新环境首次运行前：`npx playwright test tests/site/visual.spec.ts --update-snapshots` 生成基线。

**命名约定**：`{页面}-{模式}.png`，如 `首页-light.png`、`文章页-dark.png`。

---

## 5. 何时更新黄金图

只有**视觉有意变更**时才更新黄金图，且必须先确认变更正确：

1. 跑 `--update-snapshots` 生成新图；
2. 人工抽查新图（对比旧图 diff）确认观感无误；
3. 提交代码（黄金图不入库，仅代码入库）。

**反例**：布局 bug（如 flex 被 scoped 样式压掉）导致的视觉变化，绝不能 `--update-snapshots` 掩盖，必须修 bug 而非更新基线。

---

## 6. 断言配置

```ts
await expect(page).toHaveScreenshot(`${name}-${mode}.png`, {
    fullPage: true,
    maxDiffPixelRatio: 0.01,  // 抗锯齿容差 1%
});
```

- `fullPage: true`：锁定完整页面（含首屏外内容）；
- `maxDiffPixelRatio: 0.01`：容忍字体抗锯齿等微小差异，超过即失败。

---

## 7. 新增页面到视觉回归

新增真实页面（如后续友链/留言板/动态页）时：

1. 在 `tests/site/visual.spec.ts` 的 `pages` 数组加一项；
2. 运行 `--update-snapshots` 生成该页黄金图；
3. 人工抽查确认观感。

同时应更新 `tests/site/a11y.spec.ts` 的页面列表（视觉与 a11y 同步锁定）。
