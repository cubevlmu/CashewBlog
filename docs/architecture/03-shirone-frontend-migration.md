# Shirone Frontend Migration

## Goal

Convert Shirone from a generic static personal-site theme into CashewBlog's public SSR presentation layer while preserving its blog visual identity.

The fork is allowed to diverge. Do not preserve theme-package compatibility or external-content synchronization solely to make upstream merges easier.

## Keep

Keep and adapt:

- Astro 7 + Svelte 5 public rendering stack.
- Material 3 Expressive design tokens and core component library.
- current article-card visual presentation.
- current responsive/dual-sidebar layout.
- banner visual system.
- light/dark switch.
- Swup navigation if it continues to behave correctly under SSR.
- archive/category/tag/series public experiences.
- post metadata and previous/next navigation.
- TOC and floating TOC behavior.
- related/recommended posts.
- Markdown presentation and renderer capabilities: code, KaTeX, Mermaid, admonitions, heading anchors and existing article image behavior.
- RSS, sitemap, robots and standard SEO metadata.
- Umami integration.
- profile/sidebar/base footer shell.

## Remove physically

Delete page routes, feature configs, data modules, dedicated types, feature components, feature tests, example data/assets, and feature-specific scripts for:

- albums
- anime
- moments
- projects page
- skills page
- devices
- games
- friends page
- compass
- timeline
- calendar
- music
- comments
- post encryption/password protection
- article license block
- Atom
- LLMS endpoints

Do not merely set `enable: false`.

## Known upstream file groups

The current Shirone tree contains dedicated chains including:

- Albums: page routes, `AlbumCard*`, `AlbumGallery`, `AlbumSection`, `ProtectedAlbum`, scanner/types/config, example `public/images/albums/**` and tests.
- Anime: sync scripts/providers/snapshots, cards/section/config/data/page/types/utils/tests and demo assets.
- Moments: content collection, cards/gallery/section/config/page/type, thumbnail generator, demo media and tests.
- Music: media assets, `organisms/music/**`, config/data/types/utils/tests.
- Comments: `organisms/comment/{CommentSection,Giscus,Twikoo}`, config/types/tests.
- Encryption: `EncryptedContent`, `PasswordGate`, encryption/password utilities and encrypted demo content/tests.
- LLMS: config/types/util/routes/tests.
- Calendar: Calendar components, data util and test.

The frontend cleanup package includes a machine-readable deletion manifest for these paths.

## Single-locale conversion

The product does not need the 10-locale runtime. However, avoid rewriting every component string in the same commit as feature deletion.

Recommended migration:

1. Keep the existing `I18nKey` call sites temporarily.
2. Replace runtime language selection with a single dictionary, preferably `zh_CN` for the initial product.
3. Remove unused language modules: `en/es/id/ja/ko/th/tr/vi/zh_TW` once all required strings exist in `zh_CN`.
4. Remove language-switch config and language-dependent navigation/config behavior.
5. Later, if desired, rename the thin single-language service from i18n terminology; this is not required for v1.

This minimizes churn without retaining multilingual behavior.

## Visitor Display Settings

Remove `DisplaySettings` from the public top bar and remove visitor controls for:

- palette/style
- color spec
- wallpaper/banner mode
- layout mode
- texture
- other appearance choices

Keep `LightDarkSwitch` only. Appearance comes from `/api/site/bootstrap` and administrator settings.

## Static Content Collection replacement

Current `getCollection()` access and `getStaticPaths()` are build-time concepts. Replace them with a repository/client layer.

Suggested frontend interfaces:

```ts
interface BlogApi {
  getBootstrap(): Promise<SiteBootstrap>;
  getPosts(query: PostListQuery): Promise<Paged<PostSummary>>;
  getPost(slug: string): Promise<PostDetail | null>;
  getArchive(): Promise<ArchiveModel>;
  getCategories(): Promise<CategorySummary[]>;
  getTags(): Promise<TagSummary[]>;
  getSeries(): Promise<SeriesSummary[]>;
  getSeriesBySlug(slug: string): Promise<SeriesDetail | null>;
  search(query: string): Promise<SearchResponse>;
  getCustomPage(slug: string): Promise<CustomPageDto | null>;
}
```

Do not have components call `fetch()` ad hoc. Centralize HTTP/DTO adaptation in `src/lib/api` or equivalent.

## Dynamic routing

Public routes should be runtime SSR rather than build-time enumerated routes.

Core routes:

```text
/
/posts/{slug}
/archive
/categories
/tags
/series
/series/{slug}
/{custom-page-slug...}
/rss.xml
/sitemap.xml
/robots.txt
```

Custom Page catch-all must come after/respect reserved system route names.

## Search

Delete Pagefind build/indexing once backend search is connected.

Preserve the current search panel/interaction where useful, but replace `window.pagefind.search()` with `/api/search?q=...`.

## Content rendering

The backend returns Markdown; Astro renders it using the retained Shirone Markdown pipeline. Do not store rendered HTML as the primary content.

A cache of rendered output may exist at the frontend/server layer if profiling later shows benefit, but the API/storage contract remains Markdown-first.

## Sidebar

Replace hard-coded/config-file widget orchestration with dynamic bootstrap settings. Retained widgets:

- profile
- announcement
- categories
- tags
- recent posts
- stats
- TOC

Remove `music` and `calendar` widget types and all removed-feature page keys.

## Navigation

Navigation is dynamic, two-level, and loaded from bootstrap. Remove dedicated presets for deleted pages. System routes, custom-page references and external URLs coexist in the same model.

## Footer

Footer HTML is administrator-trusted and may include `<script>`. It must be injected only from authenticated-admin-managed settings. Document CSP implications.

## Custom Pages

Implement a generic SSR Custom Page renderer instead of reviving removed dedicated pages.

Use a stable root container such as:

```html
<article class="cashew-custom-page" data-layout="wide">...</article>
```

Expose stable theme-facing classes/tokens for admin-authored HTML; avoid requiring authors to depend on fragile internal utility class names.

## Build tooling cleanup

Once API migration is complete, remove:

- Pagefind build step/config.
- external-content sync/eject/export/watch scripts.
- `new-post` CLI.
- Shirone npm-package integration/packaging abstractions that exist only for theme distribution.
- moments thumbnail generation.
- anime sync.
- AI skill packaging/check scripts if not useful for CashewBlog development.

Do this only after public frontend runs against API fixtures or real backend so the project remains testable during migration.
