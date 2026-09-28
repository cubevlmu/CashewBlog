# CashewBlog

CashewBlog 是一个**单管理员、数据库驱动的个人博客 CMS**：保留 [Shirone](https://github.com/LyraVoid/Shirone)
的 Material 3 Expressive 前台视觉与阅读体验，把静态主题改造成可在后台编辑、单镜像部署的动态站点。

- **前台**：Astro SSR + Svelte（`apps/web`，源自 Shirone）
- **后台**：Vue 3 + PrimeVue + Milkdown（`apps/admin`，挂载在 `/admin`）
- **后端**：ASP.NET Core 10 + EF Core + PostgreSQL，Clean Architecture（`src/`）
- **部署**：一个应用镜像（ASP.NET 网关 + Astro Node + 后台静态资源），PostgreSQL 由你自行提供

## 功能概览

文章（草稿 / 发布 / 私密，发布后的工作副本与自动保存）、分类 / 标签 / 系列、自定义页面（HTML + 作用域 CSS，
支持嵌套 slug）、本地媒体库（WebP 展示图与缩略图、引用保护）、PostgreSQL 全文搜索（pg_trgm，高亮片段）、
阅读量统计（30 分钟去重）、RSS / Sitemap / robots / OpenGraph、后台可配置的导航、双侧栏、横幅、主题色与页脚、
可拖拽的仪表盘、回收站（30 天自动清理）、设置与文章导出。访客端只保留明暗模式切换。

设计与决策见 [`docs/architecture/`](docs/architecture/00-README.md)，已实现的 REST 契约见 [`docs/api.md`](docs/api.md)。

## 部署（Docker）

```bash
docker build -t cashewblog .
docker run -d -p 8080:8080 -v ./data:/data -v ./uploads:/uploads cashewblog
```

首次访问 `http://localhost:8080/setup`，按向导填写站点信息、管理员密码、PostgreSQL 连接（数据库需提前创建）
与上传目录。初始化后配置写入 `/data/config.json`（管理员密码以 Argon2id 哈希保存），之后升级时应用会在启动时
自动执行数据库迁移。修改数据库连接请停机后编辑 `/data/config.json`。完整数据库备份请使用 `pg_dump`。

`docker-compose.example.yml` 提供了一个附带 PostgreSQL 的示例编排。

## 本地开发

需要 .NET SDK 10、Node.js ≥ 22.12、pnpm 10、PostgreSQL。

首次使用前，请用 PostgreSQL 管理员连接已有的 `postgres` 数据库，执行：

```sql
CREATE DATABASE cashewblog OWNER postgres;
```

这里的 `postgres` 是数据库用户，和博客管理员密码无关。若使用其他数据库用户，请修改 OWNER。
Setup 会创建表结构，但不会创建数据库；`database_not_found` 表示数据库名称不存在。
首次访问请打开 API 网关的 `/setup`；完成初始化之前，公开 API 返回 `503 setup_required` 是正常行为。

只需一个终端：

```bash
pnpm install
pnpm dev
```

统一入口是 **http://127.0.0.1:8080**：前台 `/`，后台 `/admin`，首次初始化 `/setup`。
启动器自动构建管理端和 API，再启动 Astro、API 和后台构建监听；`Ctrl+C` 一次停止全部子进程。
前台修改即时更新；后台源码修改自动重新构建并复制到网关，构建完成后刷新页面即可。
PostgreSQL 仍由外部服务提供，首次使用仍需先建库和完成 setup。

如果原来已分别运行 `dev:api` / `dev:web`，请先关闭那些终端，再用 `pnpm dev`，避免占用端口。
启动器发现端口占用会退出并提示，不会结束已有服务。构建中间文件位于已忽略的 `.local-dev/`。
可通过 `CASHEWBLOG_PORT` / `CASHEWBLOG_WEB_PORT` 调整网关和内部 Astro 端口。

独立调试命令仍保留：`pnpm dev:api`、`pnpm dev:web`、`pnpm dev:admin`。
后台 Vite 单独启动时使用 `http://localhost:5174/admin/`，未初始化时进入 `/admin/setup`。
只需更新网关里的后台静态资源时运行 `pnpm build:admin`。

检查与测试：

```bash
dotnet build CashewBlog.slnx && dotnet test CashewBlog.slnx   # 集成测试需先运行 tests/scripts/start-test-postgres.sh
pnpm --filter @cashewblog/web check && pnpm -r test && pnpm -r build
```

管理端参考 SiriusNet 的 dashboard 结构：分组侧栏、可折叠导航、顶栏、统计卡片及手机抽屉菜单。
使用 PrimeVue Aura 橙色主题、明暗模式及组件，以 Tailwind 工具类处理布局，不自写组件皮肤；文章正文使用 Milkdown，页面 HTML/CSS 使用 Monaco。
所有导航入口均接入 REST API，媒体选择器可用于正文、封面和页面；设置表单覆盖站点外观、导航、侧栏等。

浏览器验收需要一个**已初始化的本地测试实例**（外部 PostgreSQL、API、Astro 都启动），以及 Chrome：

```powershell
$env:CASHEWBLOG_E2E_URL = 'http://127.0.0.1:8080'
$env:CASHEWBLOG_E2E_PASSWORD = '<测试实例管理员密码>'
pnpm test:admin:e2e
```

脚本只允许 loopback 地址，创建自己的文章、分类、页面和附件，并在结束时清理这些记录。
覆盖发布、工作副本、私密访问、媒体引用保护、Monaco、回收站恢复及公开页面。
当前验收记录与尚未运行的 Docker 门槛见 [`docs/acceptance.md`](docs/acceptance.md)。

## 致谢与许可

前台源自 [Shirone](https://github.com/LyraVoid/Shirone)（MIT，© matsuzaka-yuki，基于 saicaca 的 Fuwari）。
CashewBlog 以 MIT 许可发布，见 [`LICENSE`](LICENSE)。
