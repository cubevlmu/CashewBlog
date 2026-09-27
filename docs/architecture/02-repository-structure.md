# Repository Structure

CashewBlog is a single monorepo. It is not maintained as an installable Shirone theme package.

```text
CashewBlog/
├─ apps/
│  ├─ web/                         # Astro + Svelte public frontend (Shirone-derived)
│  │  ├─ src/
│  │  ├─ public/
│  │  └─ package.json
│  └─ admin/                       # Vue 3 + PrimeVue admin SPA
│     ├─ src/
│     └─ package.json
│
├─ src/
│  ├─ CashewBlog.Api/              # ASP.NET host, HTTP, auth, setup endpoints
│  ├─ CashewBlog.Application/      # use cases, DTOs, interfaces, validation
│  ├─ CashewBlog.Domain/           # entities, value objects, enums, domain rules
│  └─ CashewBlog.Infrastructure/   # EF, PostgreSQL, files, search, metrics
│
├─ tests/
│  ├─ CashewBlog.UnitTests/
│  ├─ CashewBlog.IntegrationTests/
│  ├─ web/
│  └─ admin/
│
├─ docker/
│  └─ entrypoint.sh
├─ docs/
├─ Dockerfile
├─ docker-compose.example.yml
├─ CashewBlog.sln
├─ package.json                    # optional root scripts/workspace coordination
├─ pnpm-workspace.yaml
└─ README.md
```

## Dependency direction

```text
Domain
  ↑
Application
  ↑
Infrastructure   Api
       \         /
        runtime composition
```

Rules:

- `Domain` must not reference EF Core, ASP.NET, PostgreSQL or frontend concepts.
- `Application` owns use-case contracts and interfaces such as `IMediaStorage` and `ISiteSettingsStore`.
- `Infrastructure` implements those interfaces.
- `Api` performs composition, endpoint mapping, authentication, rate limiting and static/runtime host integration.
- Public `web` talks only through the HTTP API contract; do not import backend code into Node/Astro.
- `admin` also uses the HTTP API and shares generated API TypeScript types only if generation remains simple.

## Frontend ownership

`apps/web` owns public rendering and the Shirone design system. It should not own business state such as publication status transitions or PV dedupe policy.

`apps/admin` owns administrator UX. It may use PrimeVue and does not need to resemble the public theme.

## Naming

Use `CashewBlog` consistently in project/assembly names and new source symbols. Retain upstream Shirone copyright/license notice where MIT requires it and document the derivative origin in the repository license/credits.
