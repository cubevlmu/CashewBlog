# Backend Clean Architecture

## Projects

### CashewBlog.Domain

Owns entities and invariants:

- `Post`
- `Category`
- `Tag`
- `Series`
- `MediaAsset`
- `CustomPage`
- `SiteSettings`
- analytics aggregates/value objects
- `PostStatus`
- media/reference enums

No EF attributes are required; prefer Infrastructure fluent configuration.

### CashewBlog.Application

Owns use cases and contracts.

Suggested feature folders:

```text
Application/
├─ Posts/
│  ├─ Commands/
│  ├─ Queries/
│  └─ Dtos/
├─ Taxonomy/
├─ Series/
├─ Media/
├─ CustomPages/
├─ Settings/
├─ Search/
├─ Analytics/
├─ Admin/
└─ Setup/
```

Interfaces:

- `IApplicationDbContext` or focused repositories (choose one consistent style)
- `IMediaStorage`
- `IImageProcessor`
- `ISearchService`
- `IAnalyticsService`
- `ISiteSettingsService`
- `IClock`
- `IConfigStore`

Validation may use FluentValidation or endpoint/application validators, but avoid layering ceremony that adds no behavior.

### CashewBlog.Infrastructure

Owns:

- EF Core DbContext and entity configuration.
- Npgsql/PostgreSQL.
- migrations.
- media filesystem implementation.
- image processing.
- Markdown-to-search-text extraction if implemented server-side.
- pg_trgm/search query implementation.
- analytics persistence and cleanup.
- JSON config file store.
- scheduled trash purge and analytics maintenance jobs.

### CashewBlog.Api

Owns:

- ASP.NET host.
- REST endpoints.
- auth cookie/session.
- antiforgery/CSRF.
- rate limiting.
- `/setup` gating.
- health checks.
- response caching where appropriate.
- serving `/uploads` with correct headers and path normalization.
- admin SPA/static routing integration if served directly from ASP.NET.

## API style

Use REST, not GraphQL.

Prefer endpoint groups by area:

```text
/api/posts
/api/categories
/api/tags
/api/series
/api/search
/api/site
/api/admin/*
/api/setup/*
```

Whether implemented with Minimal APIs or controllers is secondary. Keep response DTOs explicit and stable.

## Time

Persist all timestamps in UTC (`timestamptz`). Site timezone is a dynamic setting used only for presentation/grouping where needed.

`PublishedAt` is domain-controlled; never trust an admin client timestamp for first publication.

## Background jobs

Do not introduce Hangfire/Quartz for v1 unless required by implementation constraints.

Use lightweight hosted services/timers for:

- purging posts whose `PurgeAt <= now`.
- pruning expired view-dedupe entries.
- optional aggregate maintenance.

Jobs must be safe to re-run.
