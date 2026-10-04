# CashewBlog 安全警报与后台导航增强设计

## 目标

为单管理员后台提供可追踪的安全事件汇报，覆盖登录爆破、请求限流、路由探测和异常请求；同时让安全状态能够从后台顶部快速访问，并统一顶部导航的视觉样式。

## 数据与聚合

新增 `SecurityAlert` 实体及 EF Core 迁移。每条记录按 `category + sourceIp + path` 生成指纹并聚合，记录级别、说明、次数、首次发生和最后发生时间、确认状态。默认最多保留 500 条聚合事件，写入端按指纹做 30 秒节流；严重事件再次发生时清除确认状态。攻击者提供的 IP、路径和消息都限制长度，密码、密钥、Cookie 和请求正文不写入数据库。

事件类别包括：`LoginBruteForce`、`RateLimitExceeded`、`RouteProbe`、`OversizedRequest`、`InvalidContentType` 和 `RejectedRequest`。登录锁定和全局/登录限流记录安全事件；现有探测中间件记录路由扫描；请求大小和协议拒绝点提供统一记录入口。

## API

新增受管理员认证保护的 `/api/admin/security-alerts`：

- `GET` 分页列出事件，支持 `includeAcknowledged`、`severity`、`category`、`offset` 和 `limit`。
- `POST /{id}/acknowledge` 确认单条事件。
- `POST /acknowledge-all` 确认全部未处理事件。
- `DELETE /{id}` 永久删除单条事件。

响应只返回聚合后的来源 IP、路径、消息和时间，不返回任何认证秘密。

## 管理端

新增 `/admin/security-alerts` 页面，参考 SiriusNet 的表格/移动卡片布局：级别和类型筛选、未处理/历史切换、刷新、全部确认、详情抽屉和删除操作。导航中加入安全警报入口和未处理数量徽标。

顶部工具栏在导航开关和页面标题之间显示带底色的当前页面图标；明暗模式按钮旁增加设置按钮并链接到 `/admin/settings/general`。

## 验证

增加领域/应用单元测试和 API 集成测试，覆盖指纹聚合、节流、严重事件重新激活、分页筛选、确认和删除。运行 .NET build/test、Admin type-check/test/build 以及 Astro check。
