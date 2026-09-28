# Decision Log

This file is the compact source of truth for decisions aligned with the product owner.

| Area | Decision |
|---|---|
| Product name | CashewBlog |
| Upstream strategy | Fork Shirone and diverge independently; no requirement to keep easy upstream merge compatibility |
| Repository | One monorepo for public frontend, admin and backend |
| Public frontend | Astro + Svelte, Shirone-derived, SSR |
| Admin | Vue 3 + PrimeVue 5 |
| Admin license | PrimeVue 5 ships under the PrimeUI Community/Commercial license; the key is supplied at build time via `VITE_PRIMEUI_LICENSE` (never committed) |
| Admin navigation | PrimeVue Sidebar compounds with icon-collapse on desktop and offcanvas on mobile |
| Settings sections | Real sub-routes `/admin/settings/<section>`; `/admin/settings` redirects to `general` |
| Backend | ASP.NET Core + EF Core + PostgreSQL, Clean Architecture |
| Editor | In-house block WYSIWYG editor assembled from PrimeVue controls (replaced Milkdown); Markdown canonical storage; unsupported site extensions kept as raw source blocks |
| Article states | Draft / Published / Private |
| Private semantics | Authenticated administrator only |
| Scheduled posts | No |
| Revisions | No history; one autosaved working copy for editing live posts |
| Autosave | ~30 seconds + best effort on leaving |
| PublishedAt | Server-set on first publish; no manual edit; preserved after unpublish/republish |
| Article delete | Soft delete then 30-day automatic hard purge; manual permanent delete available |
| Likes | Removed |
| Comments | Removed for v1 |
| Categories/tags/series | Keep Shirone semantics: 0..1 category, many tags, 0..1 series |
| Search | Title + body + tags, highlighted snippets; PostgreSQL-only v1 |
| Views | 30-minute anonymous dedupe; Private/Draft excluded |
| Media | Local filesystem, media library, originals + WebP + thumbnails, arbitrary attachments |
| Referenced media delete | Block and show references |
| Custom Pages | Generic HTML + scoped CSS + live preview; nested slugs; no state/SEO/PV |
| Custom Page scripts | No |
| Footer scripts | Allowed, trusted admin HTML |
| Navigation | Dynamic, admin-configured, two levels, parent can be clickable |
| Sidebar | Keep dual sidebar; admin controls retained widgets/order per page type |
| Announcement | Keep; plain text from admin |
| Banner/profile | Keep, fully dynamic |
| Public personalization | Only light/dark switch; other appearance controlled by admin |
| Default color/theme controls | Dynamic admin settings; public palette/layout controls removed |
| Dashboard | Configurable widgets, including content analytics and system info |
| Authentication | Single admin password, no user system; Argon2id + 14-day secure cookie |
| Setup | First-run wizard: site, admin password, PostgreSQL, storage; DB already exists |
| DB connection changes | No admin UI; operator may edit config file while managing deployment |
| Migrations | Automatically apply at startup with concurrency lock |
| Application image | Public frontend + admin + ASP.NET in one image |
| PostgreSQL | External; not bundled in application image |
| Persistent paths | `/data`, `/uploads` |
| Export | Settings JSON + article Markdown ZIP; media excluded; pg_dump for full DB |
| Removed personal modules | Albums, Anime, Moments, Projects dedicated page, Skills, Devices, Games, Friends dedicated page, Compass, Timeline |
| Other removed features | Atom, LLMS, comments, article encryption/password, license block, music, calendar, multilingual UI |
| Image article presentation | Keep current Shirone behavior unless only tied to a deleted module |
