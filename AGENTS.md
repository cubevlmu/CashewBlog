# CashewBlog — Agent Instructions

CashewBlog is a **single-admin, database-driven personal blog CMS**. It keeps the public
reading experience of [Shirone](https://github.com/LyraVoid/Shirone) (Material 3 Expressive,
Astro + Svelte) and replaces the static-theme workflow with an ASP.NET Core backend,
PostgreSQL and a Vue 3 admin. It is an independent fork: upstream compatibility is not a goal.

It is **not** a SaaS, multi-user platform, WordPress clone or headless CMS product. Prefer
simple, maintainable, few-dependency solutions. Avoid role/permission systems, microservices,
event buses, CQRS ceremony, Redis or external search services.

## Source of truth

- `docs/architecture/*.md` — binding product and architecture decisions
  (`15-decision-log.md` is the compact summary, `14-implementation-plan.md` the phase plan).
- `docs/api.md` — the REST contract actually implemented by the backend. Frontend and admin
  code is written against it; update it in the same change as any endpoint/DTO change.
- `apps/web/AGENTS.md` — additional rules for the public frontend.

## Layout

```text
apps/web/            Astro SSR + Svelte public site (Shirone-derived)
apps/admin/          Vue 3 + PrimeVue admin SPA (served at /admin and /setup)
src/CashewBlog.Domain/          entities, enums, domain rules (no EF/ASP.NET)
src/CashewBlog.Application/     use-case services, DTOs, interfaces
src/CashewBlog.Infrastructure/  EF Core/Npgsql, migrations, files, images, search
src/CashewBlog.Api/             ASP.NET host: endpoints, auth, setup gate, gateway proxy
tests/                          .NET unit + integration tests
docker/, Dockerfile             single application image (PostgreSQL stays external)
tools/frontend-prune/           one-shot Shirone prune codemod (historical, already applied)
```

Runtime topology: ASP.NET listens on the single public port and serves `/api/*`,
`/uploads/*`, `/admin/*`, `/setup`; every other request is reverse-proxied to the Astro
Node SSR server. The Astro server calls the API over loopback and never touches the database.

## Code navigation — use CodeGraph

This repository is indexed by CodeGraph (`.codegraph/`, git-ignored). Before grepping or
reading files to understand code, use the `codegraph_explore` MCP tool (pass
`projectPath` = the repo root) or `codegraph explore "<symbols or question>"` in a shell.
After large changes run `codegraph sync .` so the index stays current.

## Conventions

- Conventional commits: `type(scope): subject` (`feat`, `fix`, `refactor`, `test`, `docs`,
  `chore`, `build`). Scopes: `web`, `admin`, `api`, `domain`, `app`, `infra`, `docker`, `docs`.
- Keep changes clean: delete dead code instead of disabling it; no compatibility shims for
  removed Shirone features (albums, anime, moments, comments, encryption, music, calendar,
  Atom, LLMS, multi-locale, visitor display settings, npm theme packaging, content sync).
- Match the surrounding style, naming and comment density. User-visible frontend copy goes
  through the single-locale dictionary (`apps/web/src/i18n`, `zh_CN`).
- All timestamps are UTC (`timestamptz`); site timezone is presentation only.
- Secrets never leave `/data/config.json`; never return DB passwords or the admin hash.

## Commands (Windows: use `pnpm.cmd` / `npx.cmd` from cmd/PowerShell)

```bash
# backend
dotnet build CashewBlog.slnx
dotnet test CashewBlog.slnx          # integration tests need the throwaway PG, see tests/scripts

# public frontend (apps/web)
pnpm install && pnpm check && pnpm test && pnpm build

# admin (apps/admin)
pnpm install && pnpm build
```

Run the relevant checks before committing; `astro check` and `dotnet build` must report
zero errors.
