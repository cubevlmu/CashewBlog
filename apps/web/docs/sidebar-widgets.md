# 侧栏 Widget 清单与契约 — Shirone 主题

> 本文档记录 `SideBar.astro` 支持的全部 widget：
> 配置形式、视觉规格、数据源、依赖与实现要点。
> 适用版本：Astro 7 + Svelte 5 + Tailwind CSS 4。
> 配套文档：`docs/sidebar-system.md`（编排机制）、`src/config/README.md`（配置契约）、`docs/fab-system.md`（FAB 与悬浮目录系统）。

---

## 1. Widget 契约总览

SideBar 按管理员侧栏设置（`Astro.locals.site.sidebarConfig.components`）动态编排 widget。
每个条目的 `type` 对应一个注册在 `SideBar.astro` 的组件：

| type | 组件 | 默认 slot | 职责与呈现 |
|---|---|---|---|
| `profile` | `Profile` | top | 博主资料卡片（头像 + 名字 + 简介 + 社交链接） |
| `categories` | `Categories` | sticky | 分类列表（按文章数降序，支持 `collapseAfter`） |
| `tags` | `Tags` | sticky | 标签列表（按文章数降序，支持 `collapseAfter`） |
| `series` | `Series` | sticky | 系列列表（按最近更新排序，支持 `collapseAfter`） |
| `recentPosts` | `RecentPosts` | sticky | 最新文章列表（支持 `collapseAfter`，默认关闭） |
| `announcement` | `Announcement` | top | 独立公告卡片（由公告设置驱动） |
| `stats` | `SiteStats` | top | 站点统计规格表 |
| `toc` | `SidebarTOC` | sticky | 当前文章目录（通常只在文章页显示） |

### 1.1 通用字段

每个 widget 条目都支持以下字段（判别联合类型中的公共部分）：

```ts
interface SidebarWidgetBase {
    /** 是否启用该 widget，false 则完全不渲染 */
    enable: boolean;
    /** 放置槽位：top（顶部随页面滚动）| sticky（吸顶跟随） */
    slot: "top" | "sticky";
    /** 所在分栏（dual 编排下有效）：primary（主栏）| secondary（副栏） */
    column?: "primary" | "secondary";
    /** 允许展示的页面列表，不填或包含当前页面类型时显示 */
    pages?: SidebarPage[];
}
```

---

## 2. Profile — 博主资料卡片

- **数据源**：管理员资料设置（`Astro.locals.site.profileConfig`）；
- **渲染**：头像（`Avatar` 原子）、博主名、简介与社交链接（`IconButton` 原子 + `Tooltip` 原子）；
- **页面范围**：全页面通用，通常置于主栏 `slot: "top"` 顶部。

---

## 3. Categories — 分类列表

- **数据源**：站点 bootstrap 的 `categories`（仅统计公开文章）；
- **渲染**：`WidgetLayout` 外壳 + 分类项列表；
- **折叠行为**：支持 `collapseAfter` 字段，超出数量后以平滑动画展开/收起；
- **页面范围**：全页面通用。

---

## 4. Tags — 标签列表

- **数据源**：站点 bootstrap 的 `tags`（仅统计公开文章）；
- **渲染**：`WidgetLayout` 外壳 + 标签 Chip 列表；
- **折叠行为**：支持 `collapseAfter` 字段；
- **页面范围**：全页面通用。

---

## 5. Announcement — 站点公告

- **数据源**：管理员公告设置（纯文本，可选链接）；
- **渲染**：纯卡片（无 `WidgetLayout` 标题外壳），支持关闭与 localStorage 记忆；
- **零额外负担**：未启用、内容为空或访客已关闭时不渲染 DOM；
- **页面范围**：默认 `pages: ["home"]`。

---

## 6. SiteStats — 站点统计

- **数据源**：站点 bootstrap 的 `stats`（文章数、总字数、总阅读量、建站日期、最后更新，由后端汇总）；
- **渲染**：`WidgetLayout` 外壳 + 键值对网格；
- **页面范围**：通常在首页与归档页显示。

---

## 7. SidebarTOC — 当前文章目录

- **数据源**：当前文章的 Markdown headings，由页面布局传给 SideBar，再透传给 `SidebarTOC`；
- **渲染**：`WidgetLayout` + 内嵌 `<table-of-contents>` 自定义元素及 `TocList` 原子，内容区限制为视口内高度（`max-height: calc(100dvh - 15rem)`）并独立滚动，平滑高亮当前阅读位置（M3 tonal pill 状态）；
- **页面范围**：默认使用 `pages: ["post"]`，侧栏位于 Swup 容器外，目录内容与当前锚点状态由既有 Swup 同步逻辑维护；
- **移动端互补**：桌面端（≥ 1024px）呈现本组件，移动端与平板端则自动切换由右下角悬浮控制流中的 `FloatingTOCPanel` 提供大纲抽屉（详见 `docs/fab-system.md`）。

---

## 8. Series — 系列列表

- **数据源**：站点 bootstrap 的 `series`（后端给出每系列公开篇数与最近更新时间，已按最近更新排序）；
- **渲染**：`WidgetLayout` 外壳 + 复用数据驱动的 `CategoryList` 原子（名称 + 数量徽标），按最近更新降序；超出 `collapseAfter`（默认 5）时在卡片底部给出「查看全部系列」入口指向 `/series/`；
- **开关**：由管理员侧栏设置启停；没有任何含公开文章的系列时不渲染（零额外负担）；
- **页面范围**：默认条目 `pages` 覆盖常规内容页，不含 `"series"` 自身页面（避免系列页上重复列出系列）。

---

## 9. 新增 widget 的设计约束

1. **外观语言**：优先复用既有原子——`MetaIcon`（单图标徽标）、`Chip` / `Button` / `Card`、`WidgetLayout`（标题外壳）、`AccentBar`；不要自创新的徽标/容器风格；
2. **外壳取舍**：短消息类（如公告）不用 `WidgetLayout`；有明确"分组 + 列表"语义的（分类/标签/统计/最新文章）使用；
3. **取数**：优先使用 `Astro.locals.site` 中 bootstrap 已带的汇总；确需额外数据时经 `Astro.locals.api` 请求，重计算放到后端；
4. **文案**：标题与标签用 `i18n(I18nKey.*)`，新增 key 写入 `zh_CN` 词典；
5. **默认关闭**：新 widget 在后端默认设置中为 `enable: false`，保证存量站点 DOM 零变化；
6. **文档同步**：`sidebar-system.md` §7 总览表 + 本文件补一节；新增 organism 同步更新 `atomic-structure.md` §6 的清单与数量。
