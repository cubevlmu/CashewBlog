# 静态配置目录约定

CashewBlog 的站点设置（标题、主题色、横幅、导航、侧栏、公告、页脚、SEO、统计、文章页选项）
由管理员在后台维护，存于 PostgreSQL，经 `GET /api/site/bootstrap` 在请求时下发，
前端通过 `Astro.locals.site`（`src/lib/site/context.ts`）读取。**这些设置不属于本目录。**

本目录只保留开发者决定、随代码发布的前端配置：

| 文件 | 作用 |
|---|---|
| `fabConfig.ts` | 悬浮按钮组的条目、设备与页面范围 |
| `contextMenuConfig.ts` | 右键菜单开关与动作 |
| `imageBloomConfig.ts` | 图片光晕效果 |
| `expressiveCodeConfig.ts` | 代码块明暗主题（`ec.config.mjs` 与 setting-utils 消费） |
| `fontConfig.ts` | 字体角色（body / cjk / mono）与来源 |
| `articleConfig.ts` | 文章页选项的解析函数（值来自管理员设置） |
| `postListConfig.ts` | 文章卡片宽度档位常量 |
| `integrationsConfig.ts` | Astro 集成选项（swup、astro-icon、svelte、Expressive Code 共享项、vite build） |

## 规则

1. 消费方从 barrel 导入：`import { fabConfig } from "@/config"`；`astro.config.mjs` 与
   `ec.config.mjs` 按文件路径导入所需模块。
2. 类型放在 `src/types/<domain>Config.ts`，通用类型在 `src/types/config.ts`。
3. 新增「管理员可调」的选项时，扩展后端 `SiteSettings` 与 `src/lib/site/settings.ts`，
   而不是在这里新建配置文件。
