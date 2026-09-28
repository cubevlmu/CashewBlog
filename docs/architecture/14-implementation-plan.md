# Implementation Plan

The order matters: remove dead Shirone features first, then introduce stable API-facing abstractions, then switch runtime data sources.

## Phase 0 — Fork baseline

- Fork Shirone as independent CashewBlog history.
- Rename package/product references.
- Preserve upstream MIT notice/credits.
- Establish monorepo layout.
- Make a baseline build/test snapshot.

Gate: unmodified/minimally renamed public frontend builds.

## Phase 1 — Frontend feature reduction

Physically remove agreed modules and their assets/tests/configs:

- personal-homepage bundles
- comments
- encryption/password
- license block
- Atom/LLMS
- music/calendar

Simplify:

- navigation
- sidebar widget types
- FAB comment action
- post route imports/branches
- content collections (remove moments)
- package scripts

Convert multilingual runtime into a single-locale compatibility layer rather than rewriting all UI call sites in one change.

Remove visitor Display Settings; retain light/dark.

Gate:

```text
pnpm install
pnpm check
pnpm type-check
pnpm test (remaining applicable tests)
pnpm build
```

No import of a deleted feature remains.

## Phase 2 — Backend skeleton and setup

- create four .NET projects
- config loader
- `/setup` gating and wizard API
- PostgreSQL test
- migrations
- Argon2id admin hash
- Data Protection key persistence
- auth cookie

Gate: clean first-run setup against empty operator-created DB and restart persistence.

## Phase 3 — Core data model/API

Implement:

- posts/status transitions/working copy
- categories/tags/series
- Custom Pages
- settings/bootstrap
- media metadata

Seed with fixture data.

Gate: integration tests cover transitions/deletion semantics.

## Phase 4 — Astro SSR conversion

- add Node SSR adapter/runtime
- remove static `getStaticPaths` for dynamic content routes
- introduce centralized Blog API client
- replace `getCollection` read models
- dynamic bootstrap/nav/sidebar/profile/banner/footer
- runtime post Markdown render
- Custom Page catch-all

Gate: public site works without `src/content/posts` as a runtime data source.

## Phase 5 — Search and analytics

- `SearchText` generation
- pg_trgm/search ranking
- highlighted snippets
- replace Pagefind UI backend
- view endpoint + 30-minute dedupe
- daily stats

Then delete Pagefind build integration.

## Phase 6 — Admin

Vue 3 + PrimeVue:

- login
- dashboard
- post list/editor
- PrimeVue Markdown editor
- media library
- taxonomy
- series
- Custom Pages/Monaco
- settings editors
- analytics
- trash

Gate: full publish workflow can be completed without editing repository files.

## Phase 7 — Static-workflow deletion

Only after dynamic paths are stable, remove remaining Shirone-specific distribution/workflow code:

- content sync/export/eject/watch
- `new-post`
- package-mode integration/CLI/templates
- external content repo code
- obsolete schemas/docs/tests
- Pagefind

Gate: repository contains no content-authoring requirement outside admin UI.

## Phase 8 — Docker

- multi-stage image
- process supervision/gateway
- persistent `/data` and `/uploads`
- health checks
- startup migration lock
- graceful shutdown

Gate: fresh image + empty data volume -> setup -> publish -> restart -> data preserved.

## Acceptance checklist

### Public

- [ ] homepage matches retained Shirone design
- [ ] pagination works
- [ ] Published only is visible anonymously
- [ ] Private works only with admin session
- [ ] Draft is not exposed
- [ ] archive/category/tag/series work
- [ ] search body/title/tags and highlight work
- [ ] RSS/sitemap exclude non-public content
- [ ] light/dark persists
- [ ] no visitor palette/layout settings UI remains
- [ ] custom page nested slugs render

### Admin

- [ ] 14-day login cookie
- [ ] WYSIWYG Markdown editing (PrimeVue editor, extensions preserved)
- [ ] autosave working copy
- [ ] public post not mutated until Update
- [ ] soft delete + trash + permanent delete
- [ ] automatic purge after 30 days
- [ ] media references block deletion
- [ ] settings control nav/sidebar/theme/banner/profile/footer
- [ ] dashboard widgets persist layout

### Operations

- [ ] first-run setup works
- [ ] DB setting not editable through admin
- [ ] automatic migrations are locked/safe
- [ ] `/data` and `/uploads` are persistent
- [ ] one app image exposes one service port
