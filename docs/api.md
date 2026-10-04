# CashewBlog HTTP API

This is the contract between the ASP.NET backend and its two clients: the Astro SSR public site
(`apps/web`) and the Vue admin (`apps/admin`). It is kept in sync with `src/CashewBlog.Api`; if the
two disagree, the code is wrong and the doc wins, so please report it.

- [Conventions](#conventions)
- [Authentication and CSRF](#authentication-and-csrf)
- [Errors](#errors)
- [Public API](#public-api)
- [Admin API](#admin-api)
- [Setup API](#setup-api)
- [Health, uploads, gateway](#health-uploads-gateway)
- [Site settings schema](#site-settings-schema)
- [Behaviour notes](#behaviour-notes)

---

## Conventions

- Base path `/api`. Same origin as the site (ASP.NET is the single public entry on port 8080).
- JSON everywhere, **camelCase** properties, **enums are camelCase strings** (`"published"`,
  `"fullWidth"`, `"siteSettings"`, ...). Unknown enum values are rejected with 400.
- Ids are UUID strings (UUIDv7).
- Timestamps are ISO-8601 strings with offset, always UTC (`"2026-09-27T16:09:57.98+00:00"`).
  Dates (daily stats) are `"yyyy-MM-dd"`.
- Nullable fields are always present and set to `null` (never omitted).
- Slugs may contain Unicode (e.g. Chinese). URL-encode them in paths
  (`/api/posts/${encodeURIComponent(slug)}`). Custom page slugs may contain `/`.
- Paged responses:

```ts
interface Paged<T> {
  items: T[];
  page: number;       // 1-based
  pageSize: number;
  totalItems: number;
  totalPages: number;
}
```

Shared enum types used below:

```ts
type PostStatus = "draft" | "published" | "private";
type SeriesStatus = "ongoing" | "completed";
type PageLayout = "default" | "wide" | "fullWidth";
type MediaKind = "image" | "attachment";
type MediaOwnerType = "post" | "customPage" | "siteSettings";
type Uuid = string;
type IsoDateTime = string;
type IsoDate = string; // yyyy-MM-dd
```

---

## Authentication and CSRF

Single administrator, password only.

| Cookie | Readable by JS | Purpose |
|---|---|---|
| `cashewblog_auth` | no (HttpOnly, SameSite=Lax, Secure on HTTPS) | Admin session, 14 days, sliding |
| `cashewblog_af` | no (HttpOnly, SameSite=Strict) | Antiforgery cookie token |
| `XSRF-TOKEN` | **yes** (SameSite=Strict) | Antiforgery request token to echo back |

**CSRF rule:** every `POST`/`PUT`/`PATCH`/`DELETE` under `/api/admin/*` (including `login`,
`logout`) must send header **`X-XSRF-TOKEN: <value of the XSRF-TOKEN cookie>`**. Missing or invalid
→ `400 { error: "csrf_invalid" }`.

The token is bound to the user identity, so it changes on login, logout and password change. The
server re-sets the `XSRF-TOKEN` cookie in those responses; simplest client strategy: **read the cookie
right before every write**. Obtain the first token with `GET /api/admin/session` (or `/api/admin/csrf`).

Unauthenticated calls to protected admin endpoints get `401 { error: "unauthorized" }` (never a
redirect). Sessions are invalidated when the password changes.

**Private/Draft preview from the SSR server:** Astro forwards the browser's `Cookie` header when
calling `GET /api/posts/{slug}`; with a valid `cashewblog_auth` cookie Draft/Private posts are returned
(with `Cache-Control: private, no-store`), otherwise 404.

---

## Errors

All errors are RFC 7807 problem details with an extra machine-readable `error` code.

```ts
interface Problem {
  type: string;
  title: string;          // human-readable message
  status: number;
  error: ErrorCode;
  traceId?: string;
  errors?: Record<string, string[]>;   // 400 validation_failed: field path -> messages
  references?: MediaReferenceDto[];    // 409 media_in_use
  maxUploadBytes?: number;             // 413 payload_too_large
}

type ErrorCode =
  | "validation_failed" // 400, see `errors` (keys like "title", "slug", "navigation[0].children")
  | "bad_request"       // 400, malformed JSON / unparsable parameter
  | "csrf_invalid"      // 400
  | "unauthorized"      // 401
  | "invalid_password"  // 401 on login
  | "forbidden"         // 403
  | "not_found"         // 404
  | "media_in_use"      // 409
  | "invalid_state"     // 409
  | "payload_too_large" // 413
  | "rate_limited"      // 429 (login: default 5 attempts / minute / IP), Retry-After: 60
  | "setup_required"    // 503 before first-run setup
  | "login_locked"      // 429 after repeated password failures; includes retryAfterSeconds
  | "turnstile_failed"; // 400 when Cloudflare Turnstile validation fails
```

---

## Public API

Anonymous. Only **Published** posts are visible (Draft/Private are excluded from every list, search,
feed, sitemap, taxonomy count and statistic).

### DTOs

```ts
interface TermRef { name: string; slug: string }

interface SeriesRef { title: string; slug: string; order: number | null }

/** Cover/media reference. url = WebP display variant (original file for non-images);
 *  width/height are those of the display image (long edge ≤ 2560). */
interface CoverDto {
  url: string;            // "/uploads/2026/09/{uuid}-display.webp"
  thumbUrl: string | null; // 384px WebP thumbnail, null for non-images
  width: number | null;
  height: number | null;
  alt: string | null;
}

interface PostSummaryDto {
  id: Uuid;
  slug: string;
  title: string;
  description: string;          // manual summary, else automatic excerpt (~160 chars)
  cover: CoverDto | null;
  category: TermRef | null;     // EFFECTIVE category: own category, else the series' defaultCategory
  tags: TermRef[];              // sorted by name
  series: SeriesRef | null;     // order = position in the series
  isPinned: boolean;
  publishedAt: IsoDateTime | null; // first publication time, server-controlled
  updatedAt: IsoDateTime;       // last explicit save/status change (autosave of live posts does not touch it)
  wordCount: number;            // CJK characters count individually + latin words
  viewCount: number;
}

interface PostLinkDto { slug: string; title: string }
interface SeriesPostLinkDto { slug: string; title: string; order: number | null }

interface PostDetailDto extends PostSummaryDto {
  contentMarkdown: string;      // canonical Markdown (render with the Shirone pipeline)
  seoTitle: string;             // manual SEO title, else title (apply the site title template yourself)
  seoDescription: string;       // manual SEO description, else description
  status: PostStatus;           // "published" unless an admin cookie is present
  previous: PostLinkDto | null; // next OLDER published post (by publishedAt, pinning ignored)
  next: PostLinkDto | null;     // next NEWER published post
  related: PostSummaryDto[];    // shared tags (2 pts each) + same effective category (1 pt); count = settings.article.discovery.relatedCount
  seriesPosts: SeriesPostLinkDto[]; // published posts of the series in reading order (includes current); [] if no series
}

interface FeedItemDto extends PostSummaryDto { contentMarkdown: string }

interface CategorySummaryDto { name: string; slug: string; description: string | null; count: number }
interface TagSummaryDto { name: string; slug: string; count: number }

interface SeriesSummaryDto {
  title: string;
  slug: string;
  description: string | null;
  status: SeriesStatus;
  count: number;                       // published posts
  defaultCategory: TermRef | null;
  latestPublishedAt: IsoDateTime | null;
  updatedAt: IsoDateTime;              // (extra) last edit of the series itself
}
interface SeriesDetailDto extends SeriesSummaryDto {
  posts: PostSummaryDto[];             // ordered by series order, then publishedAt
}

interface PublicCustomPageDto {
  title: string;
  slug: string;                 // e.g. "links/friends"
  contentHtml: string;          // sanitized on save (no scripts/handlers/javascript: URLs)
  customCss: string | null;     // raw CSS; scope it to the page container when rendering
  layout: PageLayout;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

interface SitemapDto {
  posts: { slug: string; updatedAt: IsoDateTime }[];
  pages: { slug: string; updatedAt: IsoDateTime }[];
  categories: string[];   // slugs with ≥1 published post
  tags: string[];
  series: string[];
}

interface SearchHitDto {
  slug: string;
  titleHtml: string;       // HTML-escaped title, matches wrapped in <mark>
  snippetHtml: string;     // HTML-escaped ~160-char excerpt around the first body match, <mark> highlights, "…" at cut ends
  matchedTags: string[];   // names of the post's tags containing a search term
  publishedAt: IsoDateTime | null;
  // extras (richer than the minimum contract):
  id: Uuid;
  url: string;             // "/posts/{encoded slug}"
  title: string;           // plain title
  tags: TermRef[];
  category: TermRef | null;
  cover: CoverDto | null;
  score: number;
}
interface SearchResponseDto {
  query: string;           // normalized query (terms joined by single spaces)
  items: SearchHitDto[];
  page: number;
  totalItems: number;
  pageSize: number;        // extra
  totalPages: number;      // extra
}

interface ViewResult { counted: boolean; viewCount: number }
```

`snippetHtml`/`titleHtml` are safe to inject with `set:html` / `{@html}`: the source text is escaped
and only `<mark>` tags are added.

### Endpoints

| Method & path | Query | Response |
|---|---|---|
| `GET /api/site/bootstrap` | – | `BootstrapDto` (below). Sends `ETag`, `Cache-Control: no-cache`; honours `If-None-Match` → 304 |
| `GET /api/posts` | `page`, `pageSize` (default `settings.article.pageSize`, max 50), `category`, `tag`, `series` (slugs) | `Paged<PostSummaryDto>`; order: pinned first, then `publishedAt` desc. With `series`: reading order |
| `GET /api/posts/{slug}` | `preview=true` (admin only: return the autosaved working copy as `contentMarkdown`) | `PostDetailDto` or 404. `Cache-Control: no-cache` (published) / `private, no-store` (draft, private, preview) |
| `POST /api/posts/{slug}/view` | – (no body, no CSRF) | `ViewResult`; 404 unless published |
| `GET /api/archive` | – | `PostSummaryDto[]` — **all** published posts, no content, `publishedAt` desc |
| `GET /api/feed` | `limit` (default 20, max 100) | `FeedItemDto[]`, newest first |
| `GET /api/sitemap` | – | `SitemapDto` |
| `GET /api/categories` | – | `CategorySummaryDto[]` (only with ≥1 published post; counts by effective category), by name |
| `GET /api/categories/{slug}/posts` | `page`, `pageSize` | `{ category: CategorySummaryDto; posts: Paged<PostSummaryDto> }` or 404 |
| `GET /api/tags` | – | `TagSummaryDto[]` (only with ≥1 published post), count desc then name |
| `GET /api/tags/{slug}/posts` | `page`, `pageSize` | `{ tag: TagSummaryDto; posts: Paged<PostSummaryDto> }` or 404 |
| `GET /api/series` | – | `SeriesSummaryDto[]` — all series, `latestPublishedAt` desc (series without published posts last) |
| `GET /api/series/{slug}` | – | `SeriesDetailDto` or 404 |
| `GET /api/pages/{*slug}` | – | `PublicCustomPageDto` or 404 (e.g. `/api/pages/links/friends`) |
| `GET /api/search` | `q`, `page`, `pageSize` (default 10, max 50) | `SearchResponseDto` (empty `items` for empty `q`) |

### Bootstrap

```ts
interface BootstrapDto {
  settings: PublicSiteSettings;   // SiteSettings without `dashboard` (see schema below)
  stats: {
    postCount: number;            // published posts
    totalWords: number;
    totalViews: number;
    siteStartDate: IsoDate | null;
    siteAgeDays: number | null;   // days since siteStartDate in the site time zone
    lastUpdatedAt: IsoDateTime | null; // max updatedAt of published posts
  };
  categories: CategorySummaryDto[];   // same as GET /api/categories
  tags: TagSummaryDto[];              // same as GET /api/tags
  series: SeriesSummaryDto[];         // same as GET /api/series
  recentPosts: { slug: string; title: string; publishedAt: IsoDateTime | null }[]; // 5 newest
  pages: { title: string; slug: string }[];   // all custom pages (resolve nav "page" items)
  version: string;                    // CashewBlog version, e.g. "0.1.0"
}
type PublicSiteSettings = Omit<SiteSettings, "dashboard">;
```

Cached in memory for up to 60 s and invalidated immediately by any settings/content change (view
totals may lag up to a minute).

---

## Admin API

Everything below requires the session cookie (except `csrf`, `session`, `login`, `logout`) and the
CSRF header on writes.

### Session

| Method & path | Body | Response |
|---|---|---|
| `GET /api/admin/csrf` | – | `{ token: string; headerName: "X-XSRF-TOKEN" }` (also sets `XSRF-TOKEN`) |
| `GET /api/admin/session` | – | `SessionDto` (also sets `XSRF-TOKEN`) |
| `GET /api/admin/login/options` | – | `LoginOptionsDto` (404 unless the configured login entrance was opened) |
| `POST /api/admin/login` | `{ password: string; turnstileToken?: string }` | `SessionDto`; 401 `invalid_password`; 400 `turnstile_failed`; 429 `rate_limited` or `login_locked` |
| `POST /api/admin/logout` | – | 204 |
| `POST /api/admin/password` | `{ currentPassword: string; newPassword: string }` (min 8 chars) | 204; other sessions are signed out |
| `GET /api/admin/security` | – | Current login entrance and Turnstile status (never the secret key) |
| `PUT /api/admin/security` | Current password, login path and optional Turnstile keys/token | Updated security status; keys are verified before saving |

```ts
interface SessionDto { authenticated: boolean; name: string | null /* "admin" */; expiresAt: IsoDateTime | null }
interface LoginOptionsDto { turnstileSiteKey: string | null }

### Security alerts

| Method & path | Query/body | Response |
|---|---|---|
| `GET /api/admin/security-alerts` | `includeAcknowledged`, `severity`, `category`, `offset`, `limit` | `SecurityAlertPageDto` |
| `POST /api/admin/security-alerts/{id}/acknowledge` | – | 204 |
| `POST /api/admin/security-alerts/acknowledge-all` | – | 204 |
| `DELETE /api/admin/security-alerts/{id}` | – | 204 |

Security alerts are aggregated by category, source IP and path; the API never returns passwords,
cookies, secrets or request bodies.
```

### Posts

| Method & path | Body / query | Response |
|---|---|---|
| `GET /api/admin/posts` | `q` (title/slug contains), `status`, `categoryId`, `tagId`, `seriesId`, `trash=true` (only trashed), `sort` = `updatedAt` (default) \| `createdAt` \| `publishedAt` \| `title` \| `viewCount` \| `deletedAt`, `order` = `desc` (default) \| `asc`, `page`, `pageSize` (default 20, max 100) | `Paged<AdminPostListItemDto>` |
| `POST /api/admin/posts` | `UpsertPostRequest` | 201 `AdminPostDto` (always created as Draft) |
| `GET /api/admin/posts/{id}` | – | `AdminPostDto` (also works for trashed posts) |
| `PUT /api/admin/posts/{id}` | `UpsertPostRequest` | `AdminPostDto` — explicit save / "Update": content goes live, working copy cleared |
| `DELETE /api/admin/posts/{id}` | – | 204 — soft delete (trash, purged after 30 days) |
| `POST /api/admin/posts/{id}/publish` | optional `UpsertPostRequest` | `AdminPostDto` |
| `POST /api/admin/posts/{id}/private` | optional `UpsertPostRequest` | `AdminPostDto` |
| `POST /api/admin/posts/{id}/draft` | optional `UpsertPostRequest` | `AdminPostDto` |
| `POST /api/admin/posts/{id}/autosave` | `AutosavePostRequest` | `AutosaveResult` |
| `POST /api/admin/posts/{id}/restore` | – | `AdminPostDto` |
| `DELETE /api/admin/posts/{id}/permanent` | – | 204 — hard delete (any post) |
| `POST /api/admin/posts/bulk-delete` | `{ ids: Uuid[] }` | `{ deleted: number }` (soft delete) |

For status transitions, when a body is sent it is saved first (same semantics as `PUT`), then the
transition is applied — one request for "save and publish". Without a body only the status changes.
Operations other than get/restore/permanent on a trashed post return 404.

```ts
interface UpsertPostRequest {
  title: string;                 // required, ≤ 200
  slug?: string | null;          // empty → keep current / auto-generate from title (unique, "-2" suffix);
                                 // explicit value is normalized and must be unused (400 on collision)
  description?: string | null;   // ≤ 1000; empty → automatic excerpt
  contentMarkdown: string;       // required (may be "")
  coverMediaId?: Uuid | null;
  categoryId?: Uuid | null;
  seriesId?: Uuid | null;
  seriesOrder?: number | null;   // null → keep, or append to the end when (re)assigned to a series
  tags?: string[];               // tag NAMES; matched case-insensitively, missing tags are created
  isPinned?: boolean;            // default false
  seoTitle?: string | null;      // ≤ 200
  seoDescription?: string | null;// ≤ 500
}

interface AutosavePostRequest {
  contentMarkdown: string;
  title?: string | null;         // applied to drafts only
}

interface AutosaveResult {
  status: PostStatus;
  hasWorkingCopy: boolean;       // true for published/private posts after autosave
  savedAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

interface AdminTagRef { id: Uuid; name: string; slug: string }

interface AdminPostDto {
  id: Uuid;
  title: string;
  slug: string;
  description: string | null;    // manual value only
  excerpt: string;               // automatic excerpt (fallback description)
  contentMarkdown: string;       // live content
  editingContentMarkdown: string | null; // autosaved working copy (published/private posts)
  editingSavedAt: IsoDateTime | null;
  hasWorkingCopy: boolean;
  coverMediaId: Uuid | null;
  cover: CoverDto | null;
  categoryId: Uuid | null;       // the post's OWN category (not the effective one)
  category: TermRef | null;
  seriesId: Uuid | null;
  series: SeriesRef | null;
  seriesOrder: number | null;
  tags: AdminTagRef[];
  status: PostStatus;
  isPinned: boolean;
  seoTitle: string | null;
  seoDescription: string | null;
  wordCount: number;
  viewCount: number;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
  publishedAt: IsoDateTime | null;
  deletedAt: IsoDateTime | null;
  purgeAt: IsoDateTime | null;
}

interface AdminPostListItemDto {
  id: Uuid;
  title: string;
  slug: string;
  status: PostStatus;
  cover: CoverDto | null;        // use cover.thumbUrl in tables
  category: TermRef | null;      // own category
  tags: AdminTagRef[];
  series: SeriesRef | null;
  isPinned: boolean;
  hasWorkingCopy: boolean;
  wordCount: number;
  viewCount: number;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
  publishedAt: IsoDateTime | null;
  deletedAt: IsoDateTime | null;
  purgeAt: IsoDateTime | null;
}
```

**Editor flow:** load `AdminPostDto`; the editor text is `editingContentMarkdown ?? contentMarkdown`.
Autosave every ~30 s → `POST .../autosave`. For drafts this writes the content directly; for
published/private posts it only writes the working copy (public content untouched). "Update" /
"Save" → `PUT` (or a transition with body). "Preview" → open `/posts/{slug}?preview=true` (the SSR
page passes `preview=true` to the API; see below).

### Categories, tags, series

| Method & path | Body | Response |
|---|---|---|
| `GET /api/admin/categories` | – | `AdminCategoryDto[]` (by name) |
| `POST /api/admin/categories` | `{ name: string; slug?: string \| null; description?: string \| null }` | 201 `AdminCategoryDto` |
| `PUT /api/admin/categories/{id}` | same | `AdminCategoryDto` |
| `DELETE /api/admin/categories/{id}` | – | 204 — posts become uncategorized; series default category cleared |
| `GET /api/admin/tags` | – | `AdminTagDto[]` |
| `POST /api/admin/tags` | `{ name: string; slug?: string \| null }` | 201 `AdminTagDto` |
| `PUT /api/admin/tags/{id}` | same | `AdminTagDto` |
| `DELETE /api/admin/tags/{id}` | – | 204 — only the post associations are removed |
| `GET /api/admin/series` | – | `AdminSeriesDto[]` |
| `GET /api/admin/series/{id}` | – | `AdminSeriesDetailDto` |
| `POST /api/admin/series` | `UpsertSeriesRequest` | 201 `AdminSeriesDetailDto` |
| `PUT /api/admin/series/{id}` | `UpsertSeriesRequest` | `AdminSeriesDetailDto` |
| `PUT /api/admin/series/{id}/order` | `{ postIds: Uuid[] }` | `AdminSeriesDetailDto` — sets order 1..N; unlisted posts keep relative order after them |
| `DELETE /api/admin/series/{id}` | – | 204 — posts keep existing, `seriesId`/`seriesOrder` cleared |

Names are unique case-insensitively (400 otherwise). Slug rules as for posts.

```ts
interface AdminCategoryDto {
  id: Uuid; name: string; slug: string; description: string | null;
  postCount: number;       // non-trashed posts with this as their OWN category
  publishedCount: number;
  createdAt: IsoDateTime; updatedAt: IsoDateTime;
}
interface AdminTagDto {
  id: Uuid; name: string; slug: string; postCount: number; publishedCount: number;
  createdAt: IsoDateTime; updatedAt: IsoDateTime;
}
interface AdminSeriesDto {
  id: Uuid; title: string; slug: string; description: string | null; status: SeriesStatus;
  defaultCategoryId: Uuid | null; postCount: number; publishedCount: number;
  createdAt: IsoDateTime; updatedAt: IsoDateTime;
}
interface AdminSeriesDetailDto {
  series: AdminSeriesDto;
  posts: { id: Uuid; title: string; slug: string; status: PostStatus; seriesOrder: number | null; publishedAt: IsoDateTime | null }[];
}
interface UpsertSeriesRequest {
  title: string; slug?: string | null; description?: string | null;
  status?: SeriesStatus;            // default "ongoing"
  defaultCategoryId?: Uuid | null;  // effective category for series posts without their own
}
```

### Custom pages

| Method & path | Body | Response |
|---|---|---|
| `GET /api/admin/pages` | – | `{ id, title, slug, layout, createdAt, updatedAt }[]` (by slug) |
| `GET /api/admin/pages/{id}` | – | `CustomPageDto` |
| `POST /api/admin/pages` | `UpsertCustomPageRequest` | 201 `CustomPageDto` |
| `PUT /api/admin/pages/{id}` | `UpsertCustomPageRequest` | `CustomPageDto` |
| `DELETE /api/admin/pages/{id}` | – | 204 |

```ts
interface UpsertCustomPageRequest {
  title: string;
  slug?: string | null;      // nested allowed ("links/friends"); empty → from title. Each segment is normalized.
                             // Reserved first segments → 400: admin, api, setup, posts, archive, categories,
                             // tags, series, rss.xml, sitemap.xml, robots.txt, uploads, search, _astro, page,
                             // health, favicon.ico
  contentHtml: string;       // sanitized: <script>, <iframe>, <form>/inputs, <style>, on* attributes and
                             // javascript: URLs removed; class/id/style/data-* and layout/media tags kept
  customCss?: string | null; // stored as-is except "</style" is neutralized
  layout?: PageLayout;       // default "default"
}
interface CustomPageDto {
  id: Uuid; title: string; slug: string; contentHtml: string; customCss: string | null;
  layout: PageLayout; createdAt: IsoDateTime; updatedAt: IsoDateTime;
}
```

The response contains the sanitized HTML — show it back in the editor so the admin sees what was kept.

### Media

| Method & path | Body / query | Response |
|---|---|---|
| `GET /api/admin/media` | `kind` = `image` \| `attachment`, `q` (file name / alt contains), `sort` = `newest` (default) \| `oldest` \| `name` \| `size`, `page`, `pageSize` (default 30, max 200) | `Paged<MediaAssetDto>` |
| `GET /api/admin/media/{id}` | – | `MediaAssetDto` |
| `POST /api/admin/media` | `multipart/form-data`: `file` (required), `altText` (optional) | 201 `MediaAssetDto`; 413 over `Storage.MaxUploadBytes` (default 100 MiB) |
| `PATCH /api/admin/media/{id}` | `{ altText: string \| null }` | `MediaAssetDto` |
| `DELETE /api/admin/media/{id}` | – | 204, or 409 `media_in_use` with `references` |
| `GET /api/admin/media/{id}/references` | – | `MediaReferenceDto[]` |

Upload kind is automatic: anything the image decoder can fully decode (PNG, JPEG, GIF, WebP, BMP,
TIFF, ...) becomes an `image` (original kept + WebP display variant ≤ 2560 px long edge, quality 82 +
384 px WebP thumbnail, EXIF stripped from variants); everything else (including SVG) is an
`attachment`. **Insert `url` into content** (display variant for images).

```ts
interface MediaAssetDto {
  id: Uuid;
  kind: MediaKind;
  originalFileName: string;
  mimeType: string;
  sizeBytes: number;            // original file size
  width: number | null;         // ORIGINAL pixel size (images)
  height: number | null;
  altText: string | null;
  sha256: string | null;
  createdAt: IsoDateTime;
  url: string;                  // canonical URL to insert: display WebP for images, the file for attachments
  originalUrl: string;
  displayUrl: string | null;
  thumbUrl: string | null;
  referenceCount: number;
}
interface MediaReferenceDto {
  ownerType: MediaOwnerType;
  ownerId: Uuid | null;         // null for siteSettings
  title: string;                // post/page title, or "Site settings"
  slug: string | null;
  fieldKey: string;             // post: cover | body | workingCopy; page: html | css;
                                // settings: avatar | favicon | ogImage | banner | bannerMobile
  inTrash: boolean;             // referencing post is in the trash (still blocks deletion until purged)
}
```

References are recomputed on every save by scanning for `/uploads/yyyy/MM/{uuid}...` URLs (relative
or absolute) plus the explicit cover id.

### Settings

| Method & path | Body | Response |
|---|---|---|
| `GET /api/admin/settings` | – | `SiteSettings` (full, including `dashboard`) |
| `PUT /api/admin/settings` | partial `SiteSettings` | `SiteSettings` (updated) |
| `POST /api/admin/settings/reset/{section}` | – | `SiteSettings`; `section` ∈ general, profile, appearance, banner, navigation, sidebar, announcement, footer, seo, analytics, article, dashboard |

`PUT` replaces **each top-level section present in the body wholesale**; sections not sent keep their
values. Inside a sent section, omitted properties fall back to their defaults — always send complete
sections (e.g. the whole `appearance` object from `GET`). Unknown sections, unknown enum values and
out-of-range values → 400 with field paths (`appearance.themeHue`, `navigation[1].children`). Database
settings are never exposed here.

### Analytics, system, export

| Method & path | Query | Response |
|---|---|---|
| `GET /api/admin/analytics/overview` | `range` = `7d` (default) \| `30d` | `AnalyticsOverviewDto` |
| `GET /api/admin/analytics/posts` | `sort` = `views` (default, total) \| `today` \| `views7d` \| `views30d` \| `title` \| `publishedAt`, `page`, `pageSize` | `Paged<PostAnalyticsDto>` |
| `GET /api/admin/system/info` | – | `SystemInfoDto` |
| `GET /api/admin/system/health` | – | `SystemHealthDto` |
| `GET /api/admin/export/settings` | – | JSON file download (full settings) |
| `GET /api/admin/export/posts` | – | ZIP download: `posts/{slug}.md` (YAML front matter + Markdown) and `pages/{slug}.html`; trash excluded, media not included |

```ts
interface AnalyticsOverviewDto {
  totalPosts: number;        // all non-trashed
  publishedPosts: number;
  drafts: number;
  privatePosts: number;
  trash: number;
  totalViews: number;
  todayViews: number;        // "today" in the site time zone
  range: "7d" | "30d";
  timezone: string;
  daily: { date: IsoDate; views: number }[]; // oldest → today, one entry per day (zeros included)
  topPosts: { id: Uuid; title: string; slug: string; viewCount: number }[];   // top 10 published
  recentPosts: { id: Uuid; title: string; slug: string; status: PostStatus; updatedAt: IsoDateTime; publishedAt: IsoDateTime | null }[]; // 10
}
interface PostAnalyticsDto {
  id: Uuid; title: string; slug: string; status: PostStatus; publishedAt: IsoDateTime | null;
  viewCount: number; todayViews: number; views7d: number; views30d: number;
}
interface SystemInfoDto {
  version: string;
  startedAt: IsoDateTime;
  uptimeSeconds: number;
  cpuUsagePercent: number | null;       // this process, across all cores, since the previous call
  processorCount: number;
  processMemoryBytes: number;           // working set
  gcHeapBytes: number;
  systemMemoryTotalBytes: number | null;
  systemMemoryAvailableBytes: number | null; // Linux only
  dotnetVersion: string;                // ".NET 10.0.x"
  osDescription: string;
  nodeVersion: string | null;           // CASHEWBLOG_NODE_VERSION or `node --version`
  astroVersion: string | null;          // CASHEWBLOG_ASTRO_VERSION
  database: { healthy: boolean; serverVersion: string | null; latencyMs: number | null; error: string | null };
  uploadsDisk: { path: string; totalBytes: number | null; freeBytes: number | null };
  dataDisk: { path: string; totalBytes: number | null; freeBytes: number | null };
  uploadsUsageBytes: number;            // all files under the uploads root (cached 60 s)
  mediaCount: number;
}
interface SystemHealthDto {
  healthy: boolean;
  components: { name: "database" | "web" | "storage"; healthy: boolean; detail: string | null }[];
}
```

---

## Setup API

Available only before first-run setup. Afterwards `database/test` and `initialize` return 404;
`status` keeps working (returns `setupRequired: false`). While setup is required every other `/api`
call returns `503 setup_required` and page requests redirect (302) to `/setup`.

| Method & path | Body | Response |
|---|---|---|
| `GET /api/setup/status` | – | `SetupStatusDto` |
| `POST /api/setup/database/test` | `DatabaseTestRequest` | `DatabaseTestResult` (always 200; check `ok`) |
| `POST /api/setup/initialize` | `InitializeRequest` | `{ initialized: true; redirectTo: "/<configured-or-generated-login-entrance>" }`; 400 with field errors (`database` holds connection/migration errors) |

```ts
interface SetupStatusDto {
  setupRequired: boolean;
  defaults: { storageRoot: string; maxUploadBytes: number; timezone: string; databasePort: number; sslMode: string };
}
interface DatabaseTestRequest {
  host: string; port?: number /* 5432 */; database: string; username: string; password?: string;
  sslMode?: "Disable" | "Allow" | "Prefer" | "Require" | "VerifyCA" | "VerifyFull"; // default Prefer
}
interface DatabaseTestResult {
  ok: boolean;
  code: "ok" | "invalid_input" | "host_unreachable" | "auth_failed" | "database_not_found"
      | "ssl_error" | "timeout" | "extension_unavailable" | "error";
  message: string | null;       // human-readable, never contains the password
  serverVersion: string | null;
  trigramAvailable: boolean | null;
}
interface InitializeRequest {
  siteName: string;             // ≤ 100
  siteUrl: string;              // absolute http(s)
  adminName: string;            // profile display name
  timezone?: string;            // IANA id, default "Asia/Shanghai"
  password: string;             // ≥ 8 chars; stored as Argon2id hash
  database: DatabaseTestRequest; // the database must already exist; migrations run automatically
  storage?: { root?: string | null; maxUploadBytes?: number | null }; // defaults from status
  security?: {
    loginPath?: string | null; // empty → generated secret entrance
    turnstileSiteKey?: string | null;
    turnstileSecretKey?: string | null;
    turnstileToken?: string | null; // required when Turnstile keys are supplied
  };
}
```

Initialization tests the database, runs migrations (under a PostgreSQL advisory lock), seeds
`SiteSettings` (site name/url/timezone, profile name, `siteStartDate` = today), writes
`{DataDir}/config.json` atomically and switches the running process to normal mode — no restart. The
admin then logs in normally.

---

## Health, uploads, gateway

| Path | Behaviour |
|---|---|
| `GET /health/live` | 200 `{ status: "live" }` |
| `GET /health/ready` | 200 `{ status: "setup_required" }` before setup; otherwise 200 `{ status: "ready", database, web, webDetail }` or 503 `{ status: "unavailable", ... }` (checks DB and the Astro upstream unless `CASHEWBLOG_READY_CHECK_WEB=false`) |
| `GET /uploads/**` | Files from the storage root. `X-Content-Type-Options: nosniff`, `Cache-Control: public, max-age=31536000, immutable`, ETag/Range support. Images/audio/video/PDF inline; everything else `Content-Disposition: attachment`. Non-PDF responses carry a sandboxing CSP. Path traversal → 404 |
| `GET /admin`, `/admin/**`, `/setup` | Admin SPA: `/admin/assets/**` and other files from `wwwroot/admin` (hashed assets cached 1 year); other paths fall back to `wwwroot/admin/index.html`. 404 text if the admin build is missing |
| `/api/**` (unknown) | JSON 404 |
| everything else | Reverse-proxied to Astro SSR (`CASHEWBLOG_WEB_UPSTREAM`, default `http://127.0.0.1:4321`) with the original `Host`, cookies, and fresh `X-Forwarded-For/Proto/Host`. If Astro is down: HTML 502 page |

URL layout of uploads: `/uploads/yyyy/MM/{uuidv7}-original.{ext}`, `{uuidv7}-display.webp`,
`{uuidv7}-thumb.webp` for images; `/uploads/yyyy/MM/{uuidv7}{.ext}` for attachments. Names never
change, so URLs can be cached forever.

---

## Site settings schema

Stored as one JSONB document (`SiteSettings` table, singleton, with `schemaVersion`). Defaults shown
in comments. `GET /api/admin/settings` returns this; `bootstrap.settings` is the same minus `dashboard`.

```ts
interface SiteSettings {
  schemaVersion: 1;
  general: {
    siteName: string;            // "CashewBlog" (setup value)
    siteUrl: string;             // "http://localhost:8080/" (setup value), absolute http(s)
    subtitle: string;            // ""
    description: string;         // ""
    keywords: string[];          // []
    timezone: string;            // "Asia/Shanghai" (setup value), IANA id — used for daily stats/"today"
    language: string;            // "zh-CN"
    favicon: string | null;      // URL
    siteStartDate: string | null;// yyyy-MM-dd, default = setup date
  };
  profile: {
    avatar: string | null;       // URL
    name: string;                // admin nickname from setup
    bio: string;                 // ""
    email: string;               // ""
    links: { name: string; icon: string /* iconify id, e.g. "fa6-brands:github" */; url: string }[];
  };
  appearance: {
    themeHue: number;            // 315, 0-360
    themeStyle: "tonalSpot" | "vibrant" | "content" | "expressive" | "rainbow" | "fruitSalad" | "monochrome" | "neutral" | "fidelity"; // "tonalSpot"
    themeSpec: "2021" | "2025";  // "2025"
    defaultMode: "light" | "dark" | "system"; // "system"
    allowModeSwitch: boolean;    // true
    backgroundMode: "banner" | "none"; // "banner"
    texture: {
      preset: "none" | "starlight" | "cyberDots" | "topography" | "geometric" | "sakura"; // "none"
      opacity: number;           // 0.12, 0.05-0.25
      allowMotion: boolean;      // true
    };
    topAppBarAlign: "left" | "center";          // "center"
    progressIndicatorStyle: "dual" | "single";  // "dual"
    postList: {
      layout: "list" | "grid";                  // "list"
      cover: "left" | "right";                  // "right"
      cardWidth: "compact" | "regular" | "relaxed"; // "regular"
    };
  };
  banner: {
    desktop: string[];           // image URLs in carousel order; [] = no banner image
    mobile: string[];            // []
    position: "top" | "center" | "bottom";      // "center"
    height: "short" | "default" | "tall";       // "default"
    dim: { enable: boolean /* true */; opacity: number /* 0.24, 0-1 */ };
    homeText: {
      enable: boolean;           // true
      title: string;             // = siteName at setup
      subtitles: string[];       // []
      typewriter: { enable: boolean /* true */; speed: number /* 100 */; deleteSpeed: number /* 50 */; pauseTime: number /* 2000 */; loop: boolean /* true */ };
    };
    carousel: {
      enable: boolean;           // true
      interval: number;          // 6000, ≥ 3000 ms
      fadeDuration: number;      // 1200
      animation: "kenBurns" | "zoomIn" | "zoomOut" | "panLeft" | "panRight" | "none"; // "kenBurns"
    };
    waves: boolean;              // true
  };
  navigation: NavItem[];
  // default: home, archive, and "更多" (type url, empty target, icon material-symbols:apps-rounded)
  // with children categories, tags, series
  sidebar: {
    enable: boolean;             // true
    arrangement: "single" | "dual"; // "dual"
    side: "left" | "right";      // "left" (for single)
    widgets: SidebarWidget[];
  };
  announcement: {
    enable: boolean;             // false
    title: string;               // ""
    content: string;             // "" plain text (not HTML)
    closable: boolean;           // true
    link: { enable: boolean /* false */; text: string; url: string; external: boolean /* true */ };
  };
  footer: { html: string };      // "" — TRUSTED admin HTML, may contain scripts, never sanitized
  seo: {
    titleSeparator: string;      // " - "
    defaultDescription: string;  // ""
    keywords: string[];          // []
    ogImage: string | null;
    twitterHandle: string;       // ""
    extraRobots: string;         // "" extra lines appended to robots.txt
  };
  analytics: { umami: { enable: boolean /* false */; shareUrl: string; websiteId: string; scriptUrl: string } };
  // when umami.enable: scriptUrl must be absolute http(s) and websiteId non-empty
  article: {
    pageSize: number;            // 8, 1-50 (default page size of GET /api/posts)
    toc: { enable: boolean /* true */; depth: number /* 2, 1-3 */ };
    lastUpdated: { enable: boolean /* true */; minimumAgeDays: number /* 90, ≥ 0 */ };
    discovery: { enable: boolean /* true */; relatedCount: number /* 3, 0-6 */; randomCount: number /* 2, 0-6 */ };
    share: { enable: boolean /* true */; includeCover: boolean /* true */ };
    seriesCardPosition: "top" | "bottom"; // "bottom"
  };
  dashboard: {                   // admin-only, NOT in bootstrap
    widgets: { id: string; x: number; y: number; w: number; h: number; visible: boolean }[];
    // ids unique; x,y ≥ 0; w,h ≥ 1. Default ids: totalPosts, drafts, totalViews, todayViews, viewsTrend,
    // trash, database, popularPosts, recentPosts, runtime, cpu, memory, disk, mediaStorage (12-column grid)
  };
}

type SidebarPage = "home" | "archive" | "categories" | "tags" | "series" | "post" | "page" | "search" | "rss" | "notFound";

interface SidebarWidget {
  type: "profile" | "announcement" | "categories" | "tags" | "series" | "recentPosts" | "stats" | "toc";
  enable: boolean;
  slot: "top" | "sticky";
  column: "primary" | "secondary";
  pages: SidebarPage[];          // [] = all pages
  collapseAfter: number | null;  // null or ≥ 1
}
// default widgets, in order: profile (top, primary, all); announcement (top, primary, [home]);
// categories (sticky, primary, collapse 5); series (sticky, primary, collapse 5);
// tags (sticky, primary, collapse 6); stats (top, secondary, [home, archive, categories, tags]);
// toc (sticky, secondary, [post]); recentPosts (disabled, sticky, secondary)

interface NavItem {
  id: string;                    // unique across the whole tree
  label: string;                 // required
  icon: string | null;
  type: "home" | "archive" | "categories" | "tags" | "series" | "rss" | "page" | "url";
  target: string;                // custom page slug for "page" (required), URL for "url"
                                 // (required unless the item has children), "" otherwise
  openInNewTab: boolean;
  children: NavItem[];           // one level only: children must have children = []
}
```

Media references are tracked for `profile.avatar`, `general.favicon`, `seo.ogImage`,
`banner.desktop[]`, `banner.mobile[]` (a referenced asset cannot be deleted).

---

## Behaviour notes

**Post lifecycle.** States Draft / Published / Private. `publishedAt` is set by the server on the
first publication only and survives unpublish/republish; it is never client-editable. Private posts
are visible only with an admin session. Soft delete sets `deletedAt` and `purgeAt = deletedAt + 30
days`; a background job hard-deletes expired posts hourly (and prunes view-dedupe keys).

**Working copy.** For Published/Private posts, autosave writes only `editingContentMarkdown`;
public content changes only on an explicit `PUT`/transition-with-body, which promotes the sent
content and clears the working copy. Drafts have no working copy: autosave writes `contentMarkdown`
directly. Moving a post back to Draft merges a pending working copy into the content.

**Derived data.** On every content save the server recomputes: `wordCount`, the automatic excerpt
(fallback `description`), the search text (title + tags + description + Markdown converted to plain
text), and media references.

**Search.** PostgreSQL `pg_trgm` + `ILIKE` over published posts. Every whitespace-separated term must
occur in the post (title, tags, description or body), or the whole query must be trigram-similar to
the title (typo tolerance). Ranking: exact title > title prefix > all terms in title > title
similarity > tag match > body match/similarity; recency only breaks ties. Works for Chinese (substring
matching; no word segmentation needed). `%` and `_` in queries are literal.

**Views.** `POST /api/posts/{slug}/view` from the browser. Visitor = SHA-256(client IP + User-Agent +
server secret stored in `{DataDir}/visitor-pepper.key`); raw IPs are never stored. One count per
visitor per post per 30 minutes; increments `viewCount` and the daily bucket. Daily buckets use the
**site time zone** (`settings.general.timezone`). The client IP is taken from `X-Forwarded-For` only
when the request comes from a trusted proxy (loopback, plus `CASHEWBLOG_TRUSTED_PROXIES`).

**Effective category.** Public DTOs, `/api/posts?category=`, and public category counts use the
post's own category, or — when it has none — its series' `defaultCategory`. Admin DTOs show the
post's own category.

**Preview.** `GET /api/posts/{slug}?preview=true` with an admin cookie returns the working copy as
`contentMarkdown` (published/private posts) and never caches. Without an admin cookie `preview` is
ignored.

**HTML policy.** Custom page HTML is sanitized on save (see above). Footer HTML is trusted and
returned verbatim — the backend sets no CSP on proxied pages; if Astro adds one it must allow the
footer's scripts (e.g. `'unsafe-inline'` or hashes).
