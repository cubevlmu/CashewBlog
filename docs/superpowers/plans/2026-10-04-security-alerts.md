# Security Alerts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist aggregated security incidents, expose an admin alert API/page, and match SiriusNet's top-navigation treatment.

**Architecture:** Add a `SecurityAlert` EF entity and a singleton recorder that hashes `category + source IP + path`, throttles writes, aggregates repeated incidents, and trims old rows. The API exposes authenticated list/acknowledge/delete operations; the Vue admin consumes them through a dedicated route and header badge.

**Tech Stack:** ASP.NET Core minimal APIs, EF Core/Npgsql migrations, Vue 3, PrimeVue 5, TypeScript, Vitest/xUnit.

**Spec:** `docs/superpowers/specs/2026-10-04-security-alerts-design.md`

## Global Constraints

- Never persist passwords, secrets, cookies, or request bodies.
- Keep all timestamps UTC.
- Preserve single-admin authentication and CSRF behavior.
- Keep user-visible admin copy in the existing Chinese UI style.
- Do not add external services or dependencies.

## Review Focus

- Repeated events must aggregate and never create unbounded rows; test the fingerprint and write gate.
- Critical events must clear acknowledgement when they recur; test reactivation.
- Attacker-controlled IP/path/message values must be length limited; test long inputs.
- Alert API writes require the existing admin session and CSRF token; test anonymous and invalid-id responses.
- A zero-alert page and a failed API load must render safely; test frontend state and empty data.

### Task 1: Domain, persistence, and recorder

**Files:**
- Create `src/CashewBlog.Domain/Entities/SecurityAlert.cs`.
- Modify `src/CashewBlog.Application/Abstractions/Interfaces.cs`.
- Modify `src/CashewBlog.Infrastructure/Persistence/AppDbContext.cs` and add EF migration.
- Create `src/CashewBlog.Infrastructure/Security/SecurityAlertRecorder.cs`.
- Test in `tests/CashewBlog.UnitTests/SecurityAlertTests.cs`.

- [ ] Add entity, `DbSet`, model indexes, recorder aggregation/throttling/retention, and unit tests.
- [ ] Run the focused unit tests and migration model validation.

### Task 2: Record events and expose admin API

**Files:**
- Modify `src/CashewBlog.Api/Program.cs` and security middleware/endpoint files.
- Modify `src/CashewBlog.Api/Endpoints/AdminAuthEndpoints.cs` or create `SecurityAlertEndpoints.cs`.
- Modify login/rate-limit paths to call the recorder.
- Modify `docs/api.md`.
- Test `tests/CashewBlog.IntegrationTests/SetupFlowTests.cs` or a dedicated alert test.

- [ ] Add list/filter/pagination, acknowledge, acknowledge-all, and delete endpoints under `/api/admin/security-alerts`.
- [ ] Record login lockout, rate-limit rejection, route probes, oversized requests, malformed content types, and rejected requests.
- [ ] Verify authorization, CSRF, aggregation, and response DTO privacy.

### Task 3: Admin navigation and security alert page

**Files:**
- Modify `apps/admin/src/api/types.ts`, `apps/admin/src/navigation.ts`, and `apps/admin/src/router.ts`.
- Create `apps/admin/src/views/SecurityAlertsView.vue`.
- Modify `apps/admin/src/App.vue` and `apps/admin/src/components/AdminNavigation.vue`.
- Add/modify `apps/admin/tests/security-alerts.test.ts` and navigation tests.

- [ ] Add alert DTOs and client calls, route/menu entry, unread badge, filters, responsive list/table, detail drawer, and actions.
- [ ] Add periodic unread refresh with bounded polling and safe empty/error states.
- [ ] Add the SiriusNet-style page icon background and settings button beside the theme button.
- [ ] Run Admin type-check, tests, and production build.

### Task 4: Documentation and full verification

**Files:**
- Modify `docs/architecture/12-security.md`, `docs/architecture/07-admin-ui-spec.md`, and `docs/acceptance.md`.

- [ ] Document alert categories, retention, API behavior, and the header entry.
- [ ] Run `dotnet build CashewBlog.slnx`, `dotnet test CashewBlog.slnx`, `pnpm --filter @cashewblog/admin test`, `pnpm --filter @cashewblog/admin build`, and `pnpm --filter @cashewblog/web check`.
