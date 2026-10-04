# Security

## Admin authentication

Single administrator, password only.

- password hash: Argon2id
- no Users/Roles tables
- authenticated via secure HTTP-only cookie
- session lifetime: 14 days
- explicit logout
- rotate cookie/session protection keys persistently where ASP.NET Data Protection requires it

Cookie configuration in production:

- `HttpOnly=true`
- `Secure=true`
- appropriate `SameSite` (normally Lax for same-origin app)

## Login defense

- rate-limit login attempts
- constant-time/hash-verification behavior through established library
- do not distinguish nonexistent account because no account concept exists
- log failed attempts without logging passwords
- the login entrance is configurable (a generated single path segment by default); anonymous `/admin` pages and the login API stay hidden until that entrance is opened
- Cloudflare Turnstile can be enabled from setup or Security settings; the backend validates tokens with Cloudflare Siteverify and never exposes the secret key
- repeated failures from one address trigger an in-memory exponential lockout in addition to the request rate limiter

Security alerts are retained as PostgreSQL aggregates (up to 500 rows) keyed by category, source IP and
request path. Administrators can inspect, acknowledge, acknowledge all, or delete them from the admin UI.

## CSRF

Admin writes use cookie auth, therefore protect state-changing requests with ASP.NET antiforgery/CSRF strategy. Same-origin alone is not a sufficient reason to omit CSRF protection.

## Setup security

- setup endpoints are enabled only before initialization
- config write is atomic
- never return database password or password hash from APIs
- setup connection-test errors should be useful but not dump arbitrary secrets

## Media

- server-generated storage names
- canonical path checks
- no relative traversal
- upload size limits
- image decoding validation
- serve attachments as inert data; uploads directory must never be a code execution root

## HTML/script policy

### Custom Pages

Scripts are not supported. Reject/sanitize:

- `<script>`
- event-handler attributes (`onclick`, `onload`, ...)
- `javascript:` URLs

Per-page CSS is allowed.

### Footer

Footer HTML/scripts are explicitly trusted administrator code. Do not sanitize scripts away. The admin UI must show a warning.

Because footer scripts are allowed, the site cannot guarantee a strict CSP without supporting nonces/hashes or relaxing `script-src`. Document the chosen CSP policy.

## Markdown

Only administrator-created content is authored, but renderer behavior should still avoid unexpected script execution unless explicitly intended. Keep the policy consistent between editor preview and public rendering.

## Private posts

Private means authenticated admin only, not secret URL.

Avoid shared caching and indexing. Return no public metadata through lists/search/RSS/sitemap.

Media used by Private posts does **not** need authenticated media serving in v1; direct media URLs may remain public. This is an accepted product limitation.

## Database

- parameterized EF/Npgsql queries
- least-privilege DB account where practical
- DB credentials only in persistent runtime config
- database target is operator-created
- automatic migrations never drop/reset data implicitly
