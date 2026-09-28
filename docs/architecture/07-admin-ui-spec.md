# Admin UI Specification

Stack: **Vue 3 + PrimeVue 5**.

The admin should optimize implementation speed and operational clarity. It does not need to visually replicate Shirone.

The shell uses the PrimeVue Sidebar compounds: a grouped rail that collapses to icons on desktop and
becomes an offcanvas panel on mobile. Settings sections are real routes (`/admin/settings/<section>`,
with `/admin/settings` redirecting to `general`) so the sidebar can group them under 站点设置 and the
header breadcrumb can address them individually.

## Routes/menu

```text
/admin/login
/admin

Dashboard

Content
├─ Posts
├─ Categories
├─ Tags
├─ Series
├─ Pages
└─ Trash

Media
└─ Library

Analytics
├─ Overview
└─ Posts

Settings
├─ General
├─ Profile
├─ Appearance
├─ Banner
├─ Navigation
├─ Sidebar
├─ SEO
├─ Analytics
└─ Advanced
```

## Dashboard

Widget grid with persisted position/size/visibility.

Widgets:

- total posts
- drafts
- trash
- total PV
- today's PV
- 7/30-day chart
- popular posts
- recent posts
- runtime/version
- CPU
- memory
- disk
- database health
- media storage

Do not build a generalized dashboard framework beyond what these widgets require.

## Posts list

Columns:

- cover thumbnail
- title
- status
- category
- tags
- published time
- updated time
- PV
- actions

Features:

- search/filter
- state filter
- category/tag filter as convenient
- pagination
- batch soft-delete only for v1
- clear visual badge for Private and Draft
- Preview action for Private using current admin session

## Editor

Layout:

```text
┌────────────────────────────────────────────────────────────┐
│ Back     status/autosave                  Preview  Publish │
├─────────────────────────────────┬──────────────────────────┤
│                                 │ Status                   │
│ PrimeVue Markdown editor        │ Cover                    │
│                                 │ Category                 │
│ toolbar + WYSIWYG               │ Tags                     │
│                                 │ Series / order           │
│                                 │ Slug                     │
│                                 │ Summary                  │
│                                 │ SEO title/description    │
│                                 │ Pinned                   │
└─────────────────────────────────┴──────────────────────────┘
```

Body editor:

- the writing area spans the full editor width, matching the formatting toolbar
- narrow screens keep block type, bold, italic and insert inline (44px targets); the other
  actions move into the toolbar's "…" menu so the bar never overflows
- right click opens a block context menu (clipboard, format, convert, insert, move, delete);
  Shift + right click keeps the browser menu; on touch or narrow screens long press / right
  click opens the same actions in a bottom drawer
- post settings drawer: status overview, then 封面 / 内容信息 / 系列与展示 / 搜索引擎优化 panels
  (SEO collapsed until used, with a search-result preview); the summary is generated from prose only

Autosave:

- every ~30 seconds if dirty
- on blur/navigation best effort
- visible state: saving / saved / error
- route-leave warning when unsaved content remains

Preview:

- use actual public Shirone rendering route/template
- preview Draft/Private through authenticated preview token/session, not by publishing it

## Media Library

Two top-level filters/tabs: Images / Attachments.

Image card/list includes thumbnail, filename, dimensions, size, date, alt.

Actions:

- upload
- edit alt
- copy URL
- select for editor/settings
- delete
- view references if delete is blocked

## Custom Pages

Use Monaco or equivalent text editor for HTML and CSS.

Screen:

- Title
- Slug
- Layout
- HTML editor
- CSS editor
- live preview
- media picker

No SEO/status/PV UI.

## Settings

Settings should map to typed backend sections rather than arbitrary JSON editing.

### Appearance

- theme seed/color options retained from Shirone
- default mode Light/Dark/System
- allow public light/dark toggle
- layout choices controlled by admin only

### Navigation

Two-level drag/sort editor. Items support icon, name, target, order, new-window and optional parent.

### Sidebar

Per page-type layouts. Support enabling/disabling and ordering retained widget types across primary/secondary columns.

### Footer

Trusted HTML editor. Scripts are permitted. Show a clear warning that this executes arbitrary administrator-authored JavaScript on the public site.

## Setup UI

`/setup` wizard:

1. Site: name, canonical URL, admin display name, timezone.
2. Administrator: password + confirmation.
3. PostgreSQL: host, port, database, username, password, SSL mode; Test Connection.
4. Storage: upload root/max size.
5. Initialize: run migrations and persist config.

After completion `/setup` becomes unavailable.
