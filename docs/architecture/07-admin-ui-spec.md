# Admin UI Specification

Stack: **Vue 3 + PrimeVue 5**.

The admin should optimize implementation speed and operational clarity. It does not need to visually replicate Shirone.

The shell uses the PrimeVue Sidebar compounds: a grouped rail that collapses to icons on desktop and
becomes an offcanvas panel on mobile. Settings sections are real routes (`/admin/settings/<section>`,
with `/admin/settings` redirecting to `general`) so the sidebar can group them under 站点设置 and the
header breadcrumb can address them individually.

## Routes/menu

```text
/<configured-login-entrance>  (generated secret path; /admin/login is the unhidden fallback)
/admin

Dashboard

Content
├─ Posts          (menu only; expands to its sub-pages)
│  ├─ All posts
│  └─ Trash
├─ Categories
├─ Tags
├─ Series
└─ Pages

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

Widget grid with persisted position/size/visibility. Layout mode shows a dashed edit bar
(恢复默认 / 取消 / 保存布局); each widget has an eye toggle, hidden widgets stay dimmed in place and
are listed as chips that restore them.

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

A responsive card grid (thumbnail or file-type tile, filename, dimensions, size) with a toolbar:
search, kind filter (全部 / 图片 / 附件) and upload. Selecting a card opens a details drawer with
the preview, metadata, alt editing, copy URL and delete (references are listed if delete is blocked).

Editor, cover and settings image fields share one picker dialog (`MediaPickerDialog`) that embeds
the same grid in picker mode: search is focused on open, a card click selects and closes, and the
image-only variant hides attachments and the kind filter.

## Login

Split screen: a hero panel (site banner image from `/api/site/bootstrap`, site name and a hitokoto
quote) beside the sign-in form; on narrow screens only the brand header and form remain. The quote is
a best-effort cross-origin GET (`credentials: "omit"`, no referrer, short timeout) with a local
fallback, and the hero image loads with `referrerpolicy="no-referrer"`, so neither needs CORS or
cookies from third parties.

## Custom Pages

One Monaco document holds the HTML and the page's `<style>` blocks; the admin splits them into
`contentHtml` / `customCss` on save (the API and scoped-CSS rendering are unchanged). Monaco
follows the admin light/dark theme.

Screen:

- Title
- Layout (标准 / 加宽 / 全宽)
- Page address: read-only; generated from the title on creation, then kept so links stay valid
- single HTML + CSS editor
- live preview (side by side on wide screens)

No SEO/status/PV UI and no media picker (paste media URLs from the media library).

## Settings

Settings should map to typed backend sections rather than arbitrary JSON editing.

Layout: each section is a stack of PrimeVue Panels (titled groups with help text) holding a
two-column field grid; a nested object with `enable` shows that switch in its panel header.
Up to three choices render as a SelectButton, bounded numbers as sliders or steppers with units,
keyword lists as chips. A sticky bar tracks unsaved changes (save / discard / reset to defaults)
and leaving or switching sections with unsaved changes asks for confirmation.

### Appearance

- theme hue picked with a colour picker, hue slider or preset swatches; only the hue is stored
  and every swatch/palette is computed with the public site's own Material 3 engine
  (`@material/material-color-utilities`, same seed chroma/tone), so no approximate preview is shown
- palette style select previews each style's primary/secondary/tertiary colours
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
