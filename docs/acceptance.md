# Development acceptance — 2026-09-28

This records executed checks, not a deployment certification.

## Admin implementation

Vue Router routes cover setup/login, dashboard, posts/editor/trash, categories/tags/series,
custom pages, media, analytics, and all site-settings sections. PrimeVue Aura supplies form,
navigation, table, dialog, confirmation, and layout components; there is no custom admin stylesheet.
Milkdown and Monaco use their own editor resources. The Monaco host has a fixed initial height.

- Setup tests database connectivity and initializes an operator-created database.
- Posts support save/publish/private/draft, metadata, cover selection, tags, series, WYSIWYG/Markdown,
  working-copy recovery, 30-second/blur autosave, public-route preview, and leave warnings.
- Media supports multipart upload, pagination, image/attachment filters, alt text, references,
  protected deletion, and selection in posts/pages/settings.
- Categories/tags/series support CRUD; series order can be rearranged with the OrderList.
- Custom pages use HTML/CSS Monaco editors and a sandboxed iframe preview. Saved sanitized HTML
  is reflected back into the editor. Scripts cannot execute in the preview.
- Settings use section forms, including nested lists and two-level navigation sorting;
  dashboard position/size/visibility is saved to the settings API.
- Analytics uses server pagination and 7/30-day charts. Password change and exports are available.

## Executed verification

Using isolated PostgreSQL on port 55433, API on 8087 and Astro on 4327:

- First-run browser flow: site → password → PostgreSQL connection test → storage → initialize → login.
- `pnpm test:admin:e2e`: browser login, taxonomy creation, create-and-publish, live-content isolation
  during autosave, explicit update, private access restrictions, multipart upload, referenced-file
  deletion rejection, Monaco save/preview, nested public page, trash/restore, and public endpoints.
  The script creates uniquely named fixtures and removes its own records afterward.
- Separate browser check: settings saved, dashboard layout persisted, no page errors after HTML/CSS
  worker configuration. Dashboard does not overflow horizontally at 1280 px.
- API restart with the same test data: session remained valid, schema was up to date, content and
  settings persisted. Public homepage/post/nested page/RSS/sitemap returned 200.
- Admin build/type check and 4 HTTP tests passed.
- Web `astro check`: 0 errors/warnings/hints; TypeScript check, 160 tests and SSR build passed.
- .NET build: 0 errors/warnings; 80 unit and 42 integration tests passed.

## Remaining deployment gate

Docker is not installed in the current environment. The application-image build, container signal
handling and volume persistence across container recreation have **not** been verified. Run Phase 8's
fresh-image → setup → publish → recreate test on a Docker-capable machine before production use.

The browser smoke test requires `CASHEWBLOG_E2E_URL` (loopback only),
`CASHEWBLOG_E2E_PASSWORD` and an installed Chrome. It is intended for a disposable local instance.
