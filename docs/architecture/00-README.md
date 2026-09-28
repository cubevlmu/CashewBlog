# CashewBlog — Architecture & Migration Specification

This package is the implementation handoff for **CashewBlog**, a dynamic single-admin blog CMS derived from the Shirone frontend.

## Product definition

CashewBlog keeps Shirone's reading experience and Material 3 Expressive visual system, but removes the personal-homepage feature bundle and replaces the static content workflow with a dynamic architecture:

- **Public frontend:** Astro + Svelte, derived from Shirone, SSR at runtime.
- **Admin:** Vue 3 + PrimeVue, deliberately simple and operational rather than visually coupled to the public site.
- **Backend:** ASP.NET Core + EF Core + PostgreSQL, Clean Architecture.
- **Editing:** block-based WYSIWYG Markdown editor assembled from PrimeVue controls; Markdown remains the canonical storage format.
- **Deployment:** one application image containing ASP.NET, Astro SSR and the built admin assets; PostgreSQL is external.
- **Operator model:** exactly one administrator password, no user/role/permission subsystem.

## Documents

1. `01-product-requirements.md` — authoritative product decisions.
2. `02-repository-structure.md` — monorepo layout and dependency boundaries.
3. `03-shirone-frontend-migration.md` — keep/remove/replace plan for Shirone.
4. `04-backend-clean-architecture.md` — ASP.NET project architecture.
5. `05-database-design.md` — tables, constraints and lifecycle rules.
6. `06-rest-api-contract.md` — route-level API contract.
7. `07-admin-ui-spec.md` — Vue/PrimeVue admin UX.
8. `08-public-frontend-runtime.md` — Astro SSR, bootstrap and rendering rules.
9. `09-setup-and-configuration.md` — first-run setup and config file.
10. `10-media-storage.md` — local media library and references.
11. `11-search-and-analytics.md` — search, PV and dashboard metrics.
12. `12-security.md` — single-admin authentication and security constraints.
13. `13-docker-and-deployment.md` — image/runtime topology and persistent volumes.
14. `14-implementation-plan.md` — recommended implementation sequence and acceptance gates.
15. `15-decision-log.md` — compact record of decisions made during requirements alignment.

## Non-goals

CashewBlog is **not** a multi-user publishing platform, social network, hosted SaaS, or generic Shirone theme distribution. Do not preserve abstractions solely for upstream theme compatibility.

The fork is intended to **diverge independently** from Shirone upstream.
