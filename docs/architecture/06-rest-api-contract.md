# REST API Contract

Exact response shapes may evolve, but route semantics should remain stable.

## Public site

### Bootstrap

`GET /api/site/bootstrap`

Returns all public site configuration needed to render the shell in one request, including:

- general identity
- profile
- appearance/theme
- banner
- navigation
- sidebar widget definitions
- announcement
- footer HTML
- SEO defaults
- public analytics/Umami config
- article presentation settings

Cache server-side and emit ETag/cache headers. Invalidate when admin settings are changed.

### Posts

```text
GET /api/posts?page=1&pageSize=N&category=&tag=&series=
GET /api/posts/{slug}
POST /api/posts/{slug}/view
GET /api/archive
```

Anonymous `GET /api/posts/{slug}`:

- Published => 200
- Draft => 404
- Private => 404/403; do not leak metadata
- soft deleted => 404

Authenticated admin session may retrieve Private and Draft through admin endpoints; frontend Private preview may use an authenticated-aware public endpoint if desired.

### Taxonomy

```text
GET /api/categories
GET /api/categories/{slug}/posts
GET /api/tags
GET /api/tags/{slug}/posts
GET /api/series
GET /api/series/{slug}
```

### Search

`GET /api/search?q=...&page=...`

Response items include:

- slug/url
- title with or without structured highlight spans
- excerpt/snippet
- matched tags
- published date

Prefer structured highlight ranges or server-sanitized `<mark>` snippets; never return arbitrary unsanitized HTML generated from user search text.

### Custom pages

`GET /api/pages/{*slug}`

Only for the public Custom Page model. System routes take precedence.

## Admin authentication

```text
POST /api/admin/login
POST /api/admin/logout
GET  /api/admin/session
```

Login accepts only password (no username required unless UI wants a cosmetic fixed `admin` label).

## Admin posts

```text
GET    /api/admin/posts
POST   /api/admin/posts
GET    /api/admin/posts/{id}
PUT    /api/admin/posts/{id}
DELETE /api/admin/posts/{id}              # soft delete
POST   /api/admin/posts/{id}/publish
POST   /api/admin/posts/{id}/private
POST   /api/admin/posts/{id}/draft
POST   /api/admin/posts/{id}/autosave     # working copy/draft
POST   /api/admin/posts/{id}/restore
DELETE /api/admin/posts/{id}/permanent
POST   /api/admin/posts/bulk-delete
```

For a Published post, autosave writes working content only. `PUT`/`update` explicitly promotes the working copy into live content.

## Admin taxonomy

CRUD under:

```text
/api/admin/categories
/api/admin/tags
/api/admin/series
```

Apply deletion semantics from database spec.

## Media

```text
GET    /api/admin/media?kind=&q=&page=
POST   /api/admin/media
PATCH  /api/admin/media/{id}
DELETE /api/admin/media/{id}
GET    /api/admin/media/{id}/references
```

Deletion returns `409 Conflict` with references when the asset is in use.

## Custom Pages

```text
GET    /api/admin/pages
POST   /api/admin/pages
GET    /api/admin/pages/{id}
PUT    /api/admin/pages/{id}
DELETE /api/admin/pages/{id}
```

## Settings

```text
GET /api/admin/settings
PUT /api/admin/settings
POST /api/admin/settings/reset/{section}
```

Database connection information is explicitly excluded from this API.

## Analytics and system

```text
GET /api/admin/analytics/overview?range=7d|30d
GET /api/admin/analytics/posts
GET /api/admin/system/info
GET /api/admin/system/health
```

## Backup/export

```text
GET /api/admin/export/settings
GET /api/admin/export/posts
```

- settings => JSON
- posts => ZIP of Markdown + metadata
- media not included
- full DB backup remains an operator `pg_dump` responsibility

## Setup

Only available before successful initialization:

```text
GET  /api/setup/status
POST /api/setup/database/test
POST /api/setup/initialize
```

Initialization input includes:

- site name
- canonical site URL
- admin display name
- site timezone
- admin password
- PostgreSQL connection data
- storage path/max upload settings

The target PostgreSQL database must already exist. Setup runs EF migrations; it does not create the database server/database.
