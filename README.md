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

```bash
pnpm install

# 后端（网关 + API，:8080）：首次运行打开 http://localhost:8080/setup
dotnet run --project src/CashewBlog.Api

# 前台（Astro dev，:4321；网关会把非 /api、/admin、/uploads 的请求代理过来）
pnpm dev:web

# 后台（Vite dev，/admin/，代理 /api 到 :8080）
pnpm dev:admin
```

检查与测试：

```bash
dotnet build CashewBlog.slnx && dotnet test CashewBlog.slnx   # 集成测试需先运行 tests/scripts/start-test-postgres.sh
pnpm --filter @cashewblog/web check && pnpm -r test && pnpm -r build
```

## 致谢与许可

前台源自 [Shirone](https://github.com/LyraVoid/Shirone)（MIT，© matsuzaka-yuki，基于 saicaca 的 Fuwari）。
CashewBlog 以 MIT 许可发布，见 [`LICENSE`](LICENSE)。
