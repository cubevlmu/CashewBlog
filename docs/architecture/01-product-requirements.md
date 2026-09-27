# Product Requirements

## 1. Public blog

Preserve Shirone's current public blog appearance and interaction unless explicitly removed below.

Required public functionality:

- Existing Shirone homepage article-card presentation.
- Existing dual-sidebar capability.
- Existing banner behavior and visual style.
- Light/dark theme switch; visitor choice is persisted locally.
- Administrator controls all other appearance choices; visitors do not get color/layout/texture personalization controls.
- Archive.
- Categories.
- Tags.
- Series and series ordering.
- About via the Custom Page system.
- Article TOC.
- Previous/next article navigation.
- Related/recommended articles.
- RSS.
- Sitemap and robots.
- OpenGraph/Twitter metadata and canonical URLs.
- Existing Markdown rendering features, including code enhancements, KaTeX, Mermaid, admonitions and existing article image presentation behavior.
- Search over title + body + tags with highlighted matches.
- View count with anonymous 30-minute deduplication.
- Umami integration remains available as a site setting.

## 2. Article lifecycle

Article states:

- `Draft`: admin only; excluded from public lists/search/RSS/statistics.
- `Published`: public.
- `Private`: viewable only while an administrator session is authenticated; excluded from public lists/search/RSS/statistics.

Rules:

- No scheduled publishing.
- `PublishedAt` is written by the server on first publication and cannot be manually edited.
- Moving a published article back to Draft and publishing again preserves the original `PublishedAt`.
- Drafts support automatic save every ~30 seconds and a best-effort save on editor blur/exit.
- Published articles are edited through one working copy (`EditingContentMarkdown` or equivalent); autosave must never immediately mutate the live public content. Explicit **Update** publishes the working copy.
- No revision-history subsystem.
- Pinned articles supported.
- Homepage order: pinned first, then `PublishedAt DESC`.
- Soft delete first; trash is automatically permanently purged after 30 days. Manual permanent delete is also supported.
- No likes.
- No comment system in v1.

## 3. Article editor

Use Milkdown, with an editing experience closer to a toolbar-based CMS than raw Markdown.

Toolbar/features:

- headings H1–H6
- bold / italic / strike
- links
- images
- tables
- quotes
- ordered/unordered lists
- code blocks
- KaTeX
- Mermaid
- admonition/callout syntax supported by the public renderer

The canonical persisted article body is Markdown.

Editor page layout:

- main editor on the left
- settings rail on the right
- top actions: save draft / publish / update / preview
- preview uses the actual Shirone article template, not a simplified editor preview
- warn before leaving with unsaved work
- publish/update executes immediately without a second confirmation dialog

Article fields:

- title
- slug (auto-generated but manually overridable; Unicode/Chinese slugs are allowed)
- summary/description (automatic fallback plus manual override)
- content Markdown
- working-copy Markdown for editing published posts
- cover image
- category (0..1)
- tags (0..N)
- series (0..1)
- series order
- state
- pinned
- SEO title (automatic fallback plus manual override)
- SEO description (automatic fallback plus manual override)
- created / updated / published timestamps
- view count

## 4. Taxonomy

- A post has at most one category.
- A post may have many tags.
- A post may belong to at most one series.
- Series contains title, slug, optional description, status (`ongoing`/`completed`), optional default category and post ordering.
- Deleting a category sets referencing posts to uncategorized.
- Deleting a tag removes that association from all posts.
- Deleting a series leaves posts intact and sets their series reference to null.

## 5. Search

Search public Published posts only.

Indexed/searchable content:

- title
- summary
- body converted to plain text
- tags

Results are relevance-first and include highlighted/snippet matches.

Avoid introducing a separate search service in v1. PostgreSQL is the only required data service.

## 6. Media library

Local media storage only in v1.

Admin media library:

- images and attachments tabs
- upload
- delete
- search/filter
- sort by upload date
- copy URL
- display MIME, size and image dimensions
- image `alt` text

Image processing:

- retain original
- generate optimized WebP display version
- generate thumbnail(s)
- article editor inserts the optimized URL by default

Attachments may be any file type because only the administrator can upload them. No download counter.

Deletion is blocked while a media asset is referenced by an article/page/configuration item, and the admin UI should show those references.

## 7. Custom Pages

Dedicated Shirone personal-homepage modules are replaced by generic Custom Pages.

Custom Page fields:

- title
- slug; nested paths such as `links/friends` are allowed
- raw HTML
- per-page CSS
- layout (`Default`, `Wide`, `FullWidth`)
- created/updated timestamps

Rules:

- a Custom Page exists publicly once saved; no Draft/Private lifecycle in v1
- no per-page SEO editor
- no PV statistics for Custom Pages
- HTML editor is Monaco-style raw HTML/CSS editing with live preview
- media library assets can be selected/inserted
- Custom Page HTML runs within the normal public site shell and inherits stable CashewBlog/Shirone CSS tokens/classes
- Custom Page `<script>` is not supported in v1
- Custom CSS should be scoped to the page container where practical

## 8. Navigation, sidebar, banner, footer

Navigation is fully admin-controlled and supports two levels.

Navigation item types:

- home/system route
- category/archive route
- Custom Page
- external URL

Navigation fields:

- label
- icon
- target URL/reference
- order
- parent (one level only)
- open in new window

Parent navigation items may themselves be clickable.

Sidebar remains dual-column capable and is admin-configurable per page type. Widgets retained:

- Profile
- Categories
- Tags
- Recent Posts
- Announcement
- Site Stats
- TOC on article pages

Widget order, enable state and placement are configurable.

Announcement is plain text managed from admin.

Site Stats may show:

- published post count
- total word count
- total PV
- site age
- last update time

Banner settings are dynamic:

- image(s)
- height/presentation settings
- dim/overlay strength
- title
- subtitle
- existing Shirone visual behavior where retained

Profile remains dynamic:

- avatar
- display name
- bio
- social links
- email

Footer is administrator-authored HTML and **may contain scripts**. Treat this as explicitly trusted administrator content.

## 9. Appearance

The administrator configures theme appearance. Frontend visitors may only switch light/dark mode.

Admin-configurable appearance includes Shirone's retained theme seed/color behavior, banner, layout and relevant style options. The public Display Settings panel is removed.

Light/dark defaults:

- `Light`
- `Dark`
- `System`

Optional public light/dark switch can be enabled; the user's choice persists locally.

## 10. Admin model

Exactly one administrator.

Do not implement:

- Users table for publishing identities
- roles
- permissions
- invitations
- registration
- OAuth/social login
- 2FA in v1

Admin authentication is a configured password hash plus a 14-day authenticated cookie/session.

## 11. Dashboard

Dashboard consists of configurable widgets. Widget position/size/visibility is persisted.

Content widgets:

- total posts
- drafts
- trash count
- total PV
- today's PV
- 7-day / 30-day trend
- popular posts Top 10
- recent posts

System widgets:

- CashewBlog version
- uptime
- CPU
- memory
- disk usage/free space
- .NET version
- Astro/Node version where available
- PostgreSQL health/status
- media storage usage

## 12. Explicitly removed Shirone functionality

Remove the implementation, routes, configs, data, tests and assets where no longer shared:

- Albums
- Anime
- Moments / micro-posts
- Projects dedicated page
- Skills dedicated page
- Devices
- Games
- Friends dedicated page
- Compass
- Timeline
- Calendar widget
- Music player/Meting/local music subsystem
- Twikoo/Giscus comments
- Article password/encryption system
- Article license block
- Atom feed
- `llms.txt` / `llms-full.txt`
- multi-locale UI; v1 is a single-locale product
- visitor Display Settings/palette/layout customization UI
- Shirone external content-repository workflow and npm-theme packaging abstractions once the dynamic API replaces them

Image article presentation/lightbox behavior is retained unless implementation work proves a component exists solely for a removed feature.
