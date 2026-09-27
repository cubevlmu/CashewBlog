# Agent Instructions — CashewBlog public frontend (`apps/web`)

Read the repository root `AGENTS.md` first. This app is the Shirone-derived public site:
Astro 7, Svelte 5, Tailwind 4, Stylus and pnpm, organised as an M3E (Material 3 Expressive)
component library. In-site navigation uses Swup, so the persistent shell and the replaceable
page container have different lifecycles.

## Must-follow rules

- Data comes from the CashewBlog REST API (see `docs/api.md` at the repo root). Components
  never call `fetch()` ad hoc — all HTTP/DTO adaptation lives in `src/lib/api/`. Public
  pages must render Published content only; Private posts are shown only when the backend
  accepts the forwarded admin cookie. Never cache authenticated responses in shared caches.
- Appearance (theme seed, style, banner, layout, sidebar, navigation, footer) is controlled
  by the administrator through `/api/site/bootstrap`. Visitors may only switch light/dark;
  do not reintroduce palette/layout/texture/wallpaper controls.
- Optional integrations (Umami, Mermaid, KaTeX, media embeds, …) follow the **zero extra
  burden** rule: when disabled or unused on a page they add no network requests, no DOM and
  no eagerly loaded bundle.
- Never hard-code user-visible component copy. Use `src/i18n/i18nKey.ts` with the single
  `zh_CN` dictionary; parameterized strings keep their `{placeholder}` names.
- Semantic colors, radii, typography and motion use the project design tokens
  (`--shape-corner-*`, `--m3e-type-*`, `--m3e-duration-*`, `--m3e-easing-*`, surface /
  on-surface tokens). For visual changes read `DESIGN.md` and `docs/m3e-standard.md`.
- Component layering: atoms compose atoms; molecules compose atoms and suitable molecules;
  organisms compose lower layers; layouts compose components; pages compose layouts and
  components. Lower layers never import higher layers; use `@components/<layer>/<file>`.
- Atoms and molecules do not fetch data or own browser persistence. Route state,
  `localStorage` and persistent-shell synchronisation belong in organisms or utilities.
- SSR output must work without hydration. Add `client:*` only when interactivity requires it.
  On pure SSR paths use `astro-icon`; `@iconify/svelte` does not render during SSR.
- In Svelte, follow the syntax already used by the file (runes or legacy); never mix them.
  In Stylus, keep modifier and element selectors separate where `&` would concatenate wrongly.
- Persistent shell elements outside `#swup-container` are not re-rendered by Swup. Logic
  reacting to navigation uses the Swup hooks (`content:replace`, `page:view`) or event
  delegation and must work for both direct loads and client navigation.
- Custom Page HTML is sanitized by the backend (no scripts); its CSS is scoped to the
  `.cashew-custom-page` container. Footer HTML is trusted administrator code and may run
  scripts — keep that distinction.

## Documents

- `rules/pitfalls.md`, `rules/css-important.md`, `rules/project-rules.md`
- `docs/atomic-structure.md`, `docs/m3e-standard.md`
- `docs/markdown-extensions.md`, `docs/markdown-on-demand-loading.md`,
  `docs/markdown-syntax-manifest.md` — before touching the Markdown pipeline
- `docs/sidebar-system.md` — sidebar orchestration and Swup synchronisation
- The nearest nested `AGENTS.md` (`src/pages/_AGENTS.md` for pages; the underscore keeps
  Astro from treating it as a route).

## Validation

- `pnpm check` (astro check, must be 0 errors), `pnpm type-check`, `pnpm test`
  (node unit tests), `pnpm build`. Playwright specs live in `tests/site/` (`pnpm test:e2e`).
- `pnpm lint` / `pnpm format` write files; use `pnpm exec biome ci ./src` for read-only checks.
- Stale Stylus/Svelte output in dev: clear `node_modules/.vite` and `.astro`, then restart.

## Repository context

- Sidebar widgets are rendered through the `componentMap` registry in
  `src/components/organisms/SideBar.astro`. `SidebarPage` in `src/types/sidebarConfig.ts`
  lists the page identifiers used by the per-page widget filter (`data-current-page` on
  `#swup-container`).
- Motion primitives live in `src/utils/motion.ts`; honour `prefersReducedMotion()`.
- Atom inventory is authoritative only in `src/components/atoms/manifest.json`.
- Page templates live in `src/layouts/`.
