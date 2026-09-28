// REST DTOs mirrored from docs/api.md. Keep changes aligned with the contract.
export interface Paged<T> {
  items: T[];
  page: number; // 1-based
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

export type PostStatus = "draft" | "published" | "private";
export type SeriesStatus = "ongoing" | "completed";
export type PageLayout = "default" | "wide" | "fullWidth";
export type MediaKind = "image" | "attachment";
export type MediaOwnerType = "post" | "customPage" | "siteSettings";
export type Uuid = string;
export type IsoDateTime = string;
export type IsoDate = string; // yyyy-MM-dd

export interface Problem {
  type: string;
  title: string; // human-readable message
  status: number;
  error: ErrorCode;
  traceId?: string;
  errors?: Record<string, string[]>; // 400 validation_failed: field path -> messages
  references?: MediaReferenceDto[]; // 409 media_in_use
  maxUploadBytes?: number; // 413 payload_too_large
}

export type ErrorCode =
  | "validation_failed" // 400, see `errors` (keys like "title", "slug", "navigation[0].children")
  | "bad_request" // 400, malformed JSON / unparsable parameter
  | "csrf_invalid" // 400
  | "unauthorized" // 401
  | "invalid_password" // 401 on login
  | "forbidden" // 403
  | "not_found" // 404
  | "media_in_use" // 409
  | "invalid_state" // 409
  | "payload_too_large" // 413
  | "rate_limited" // 429 (login: default 5 attempts / minute / IP), Retry-After: 60
  | "setup_required"; // 503 before first-run setup

export interface TermRef {
  name: string;
  slug: string;
}

export interface SeriesRef {
  title: string;
  slug: string;
  order: number | null;
}

/** Cover/media reference. url = WebP display variant (original file for non-images);
 *  width/height are those of the display image (long edge ≤ 2560). */
export interface CoverDto {
  url: string; // "/uploads/2026/09/{uuid}-display.webp"
  thumbUrl: string | null; // 384px WebP thumbnail, null for non-images
  width: number | null;
  height: number | null;
  alt: string | null;
}

export interface PostSummaryDto {
  id: Uuid;
  slug: string;
  title: string;
  description: string; // manual summary, else automatic excerpt (~160 chars)
  cover: CoverDto | null;
  category: TermRef | null; // EFFECTIVE category: own category, else the series' defaultCategory
  tags: TermRef[]; // sorted by name
  series: SeriesRef | null; // order = position in the series
  isPinned: boolean;
  publishedAt: IsoDateTime | null; // first publication time, server-controlled
  updatedAt: IsoDateTime; // last explicit save/status change (autosave of live posts does not touch it)
  wordCount: number; // CJK characters count individually + latin words
  viewCount: number;
}

export interface PostLinkDto {
  slug: string;
  title: string;
}
export interface SeriesPostLinkDto {
  slug: string;
  title: string;
  order: number | null;
}

export interface PostDetailDto extends PostSummaryDto {
  contentMarkdown: string; // canonical Markdown (render with the Shirone pipeline)
  seoTitle: string; // manual SEO title, else title (apply the site title template yourself)
  seoDescription: string; // manual SEO description, else description
  status: PostStatus; // "published" unless an admin cookie is present
  previous: PostLinkDto | null; // next OLDER published post (by publishedAt, pinning ignored)
  next: PostLinkDto | null; // next NEWER published post
  related: PostSummaryDto[]; // shared tags (2 pts each) + same effective category (1 pt); count = settings.article.discovery.relatedCount
  seriesPosts: SeriesPostLinkDto[]; // published posts of the series in reading order (includes current); [] if no series
}

export interface FeedItemDto extends PostSummaryDto {
  contentMarkdown: string;
}

export interface CategorySummaryDto {
  name: string;
  slug: string;
  description: string | null;
  count: number;
}
export interface TagSummaryDto {
  name: string;
  slug: string;
  count: number;
}

export interface SeriesSummaryDto {
  title: string;
  slug: string;
  description: string | null;
  status: SeriesStatus;
  count: number; // published posts
  defaultCategory: TermRef | null;
  latestPublishedAt: IsoDateTime | null;
  updatedAt: IsoDateTime; // (extra) last edit of the series itself
}
export interface SeriesDetailDto extends SeriesSummaryDto {
  posts: PostSummaryDto[]; // ordered by series order, then publishedAt
}

export interface PublicCustomPageDto {
  title: string;
  slug: string; // e.g. "links/friends"
  contentHtml: string; // sanitized on save (no scripts/handlers/javascript: URLs)
  customCss: string | null; // raw CSS; scope it to the page container when rendering
  layout: PageLayout;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

export interface SitemapDto {
  posts: { slug: string; updatedAt: IsoDateTime }[];
  pages: { slug: string; updatedAt: IsoDateTime }[];
  categories: string[]; // slugs with ≥1 published post
  tags: string[];
  series: string[];
}

export interface SearchHitDto {
  slug: string;
  titleHtml: string; // HTML-escaped title, matches wrapped in <mark>
  snippetHtml: string; // HTML-escaped ~160-char excerpt around the first body match, <mark> highlights, "…" at cut ends
  matchedTags: string[]; // names of the post's tags containing a search term
  publishedAt: IsoDateTime | null;
  // extras (richer than the minimum contract):
  id: Uuid;
  url: string; // "/posts/{encoded slug}"
  title: string; // plain title
  tags: TermRef[];
  category: TermRef | null;
  cover: CoverDto | null;
  score: number;
}
export interface SearchResponseDto {
  query: string; // normalized query (terms joined by single spaces)
  items: SearchHitDto[];
  page: number;
  totalItems: number;
  pageSize: number; // extra
  totalPages: number; // extra
}

export interface ViewResult {
  counted: boolean;
  viewCount: number;
}

export interface BootstrapDto {
  settings: PublicSiteSettings; // SiteSettings without `dashboard` (see schema below)
  stats: {
    postCount: number; // published posts
    totalWords: number;
    totalViews: number;
    siteStartDate: IsoDate | null;
    siteAgeDays: number | null; // days since siteStartDate in the site time zone
    lastUpdatedAt: IsoDateTime | null; // max updatedAt of published posts
  };
  categories: CategorySummaryDto[]; // same as GET /api/categories
  tags: TagSummaryDto[]; // same as GET /api/tags
  series: SeriesSummaryDto[]; // same as GET /api/series
  recentPosts: {
    slug: string;
    title: string;
    publishedAt: IsoDateTime | null;
  }[]; // 5 newest
  pages: { title: string; slug: string }[]; // all custom pages (resolve nav "page" items)
  version: string; // CashewBlog version, e.g. "0.1.0"
}
export type PublicSiteSettings = Omit<SiteSettings, "dashboard">;

export interface SessionDto {
  authenticated: boolean;
  name: string | null /* "admin" */;
  expiresAt: IsoDateTime | null;
}

export interface UpsertPostRequest {
  title: string; // required, ≤ 200
  slug?: string | null; // empty → keep current / auto-generate from title (unique, "-2" suffix);
  // explicit value is normalized and must be unused (400 on collision)
  description?: string | null; // ≤ 1000; empty → automatic excerpt
  contentMarkdown: string; // required (may be "")
  coverMediaId?: Uuid | null;
  categoryId?: Uuid | null;
  seriesId?: Uuid | null;
  seriesOrder?: number | null; // null → keep, or append to the end when (re)assigned to a series
  tags?: string[]; // tag NAMES; matched case-insensitively, missing tags are created
  isPinned?: boolean; // default false
  seoTitle?: string | null; // ≤ 200
  seoDescription?: string | null; // ≤ 500
}

export interface AutosavePostRequest {
  contentMarkdown: string;
  title?: string | null; // applied to drafts only
}

export interface AutosaveResult {
  status: PostStatus;
  hasWorkingCopy: boolean; // true for published/private posts after autosave
  savedAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

export interface AdminTagRef {
  id: Uuid;
  name: string;
  slug: string;
}

export interface AdminPostDto {
  id: Uuid;
  title: string;
  slug: string;
  description: string | null; // manual value only
  excerpt: string; // automatic excerpt (fallback description)
  contentMarkdown: string; // live content
  editingContentMarkdown: string | null; // autosaved working copy (published/private posts)
  editingSavedAt: IsoDateTime | null;
  hasWorkingCopy: boolean;
  coverMediaId: Uuid | null;
  cover: CoverDto | null;
  categoryId: Uuid | null; // the post's OWN category (not the effective one)
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

export interface AdminPostListItemDto {
  id: Uuid;
  title: string;
  slug: string;
  status: PostStatus;
  cover: CoverDto | null; // use cover.thumbUrl in tables
  category: TermRef | null; // own category
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

export interface AdminCategoryDto {
  id: Uuid;
  name: string;
  slug: string;
  description: string | null;
  postCount: number; // non-trashed posts with this as their OWN category
  publishedCount: number;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}
export interface AdminTagDto {
  id: Uuid;
  name: string;
  slug: string;
  postCount: number;
  publishedCount: number;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}
export interface AdminSeriesDto {
  id: Uuid;
  title: string;
  slug: string;
  description: string | null;
  status: SeriesStatus;
  defaultCategoryId: Uuid | null;
  postCount: number;
  publishedCount: number;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}
export interface AdminSeriesDetailDto {
  series: AdminSeriesDto;
  posts: {
    id: Uuid;
    title: string;
    slug: string;
    status: PostStatus;
    seriesOrder: number | null;
    publishedAt: IsoDateTime | null;
  }[];
}
export interface UpsertSeriesRequest {
  title: string;
  slug?: string | null;
  description?: string | null;
  status?: SeriesStatus; // default "ongoing"
  defaultCategoryId?: Uuid | null; // effective category for series posts without their own
}

export interface UpsertCustomPageRequest {
  title: string;
  slug?: string | null; // nested allowed ("links/friends"); empty → from title. Each segment is normalized.
  // Reserved first segments → 400: admin, api, setup, posts, archive, categories,
  // tags, series, rss.xml, sitemap.xml, robots.txt, uploads, search, _astro, page,
  // health, favicon.ico
  contentHtml: string; // sanitized: <script>, <iframe>, <form>/inputs, <style>, on* attributes and
  // javascript: URLs removed; class/id/style/data-* and layout/media tags kept
  customCss?: string | null; // stored as-is except "</style" is neutralized
  layout?: PageLayout; // default "default"
}
export interface CustomPageDto {
  id: Uuid;
  title: string;
  slug: string;
  contentHtml: string;
  customCss: string | null;
  layout: PageLayout;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

export interface MediaAssetDto {
  id: Uuid;
  kind: MediaKind;
  originalFileName: string;
  mimeType: string;
  sizeBytes: number; // original file size
  width: number | null; // ORIGINAL pixel size (images)
  height: number | null;
  altText: string | null;
  sha256: string | null;
  createdAt: IsoDateTime;
  url: string; // canonical URL to insert: display WebP for images, the file for attachments
  originalUrl: string;
  displayUrl: string | null;
  thumbUrl: string | null;
  referenceCount: number;
}
export interface MediaReferenceDto {
  ownerType: MediaOwnerType;
  ownerId: Uuid | null; // null for siteSettings
  title: string; // post/page title, or "Site settings"
  slug: string | null;
  fieldKey: string; // post: cover | body | workingCopy; page: html | css;
  // settings: avatar | favicon | ogImage | banner | bannerMobile
  inTrash: boolean; // referencing post is in the trash (still blocks deletion until purged)
}

export interface AnalyticsOverviewDto {
  totalPosts: number; // all non-trashed
  publishedPosts: number;
  drafts: number;
  privatePosts: number;
  trash: number;
  totalViews: number;
  todayViews: number; // "today" in the site time zone
  range: "7d" | "30d";
  timezone: string;
  daily: { date: IsoDate; views: number }[]; // oldest → today, one entry per day (zeros included)
  topPosts: { id: Uuid; title: string; slug: string; viewCount: number }[]; // top 10 published
  recentPosts: {
    id: Uuid;
    title: string;
    slug: string;
    status: PostStatus;
    updatedAt: IsoDateTime;
    publishedAt: IsoDateTime | null;
  }[]; // 10
}
export interface PostAnalyticsDto {
  id: Uuid;
  title: string;
  slug: string;
  status: PostStatus;
  publishedAt: IsoDateTime | null;
  viewCount: number;
  todayViews: number;
  views7d: number;
  views30d: number;
}
export interface SystemInfoDto {
  version: string;
  startedAt: IsoDateTime;
  uptimeSeconds: number;
  cpuUsagePercent: number | null; // this process, across all cores, since the previous call
  processorCount: number;
  processMemoryBytes: number; // working set
  gcHeapBytes: number;
  systemMemoryTotalBytes: number | null;
  systemMemoryAvailableBytes: number | null; // Linux only
  dotnetVersion: string; // ".NET 10.0.x"
  osDescription: string;
  nodeVersion: string | null; // CASHEWBLOG_NODE_VERSION or `node --version`
  astroVersion: string | null; // CASHEWBLOG_ASTRO_VERSION
  database: {
    healthy: boolean;
    serverVersion: string | null;
    latencyMs: number | null;
    error: string | null;
  };
  uploadsDisk: {
    path: string;
    totalBytes: number | null;
    freeBytes: number | null;
  };
  dataDisk: {
    path: string;
    totalBytes: number | null;
    freeBytes: number | null;
  };
  uploadsUsageBytes: number; // all files under the uploads root (cached 60 s)
  mediaCount: number;
}
export interface SystemHealthDto {
  healthy: boolean;
  components: {
    name: "database" | "web" | "storage";
    healthy: boolean;
    detail: string | null;
  }[];
}

export interface SetupStatusDto {
  setupRequired: boolean;
  defaults: {
    storageRoot: string;
    maxUploadBytes: number;
    timezone: string;
    databasePort: number;
    sslMode: string;
  };
}
export interface DatabaseTestRequest {
  host: string;
  port?: number /* 5432 */;
  database: string;
  username: string;
  password?: string;
  sslMode?:
    "Disable" | "Allow" | "Prefer" | "Require" | "VerifyCA" | "VerifyFull"; // default Prefer
}
export interface DatabaseTestResult {
  ok: boolean;
  code:
    | "ok"
    | "invalid_input"
    | "host_unreachable"
    | "auth_failed"
    | "database_not_found"
    | "ssl_error"
    | "timeout"
    | "extension_unavailable"
    | "error";
  message: string | null; // human-readable, never contains the password
  serverVersion: string | null;
  trigramAvailable: boolean | null;
}
export interface InitializeRequest {
  siteName: string; // ≤ 100
  siteUrl: string; // absolute http(s)
  adminName: string; // profile display name
  timezone?: string; // IANA id, default "Asia/Shanghai"
  password: string; // ≥ 8 chars; stored as Argon2id hash
  database: DatabaseTestRequest; // the database must already exist; migrations run automatically
  storage?: { root?: string | null; maxUploadBytes?: number | null }; // defaults from status
}

export interface SiteSettings {
  schemaVersion: 1;
  general: {
    siteName: string; // "CashewBlog" (setup value)
    siteUrl: string; // "http://localhost:8080/" (setup value), absolute http(s)
    subtitle: string; // ""
    description: string; // ""
    keywords: string[]; // []
    timezone: string; // "Asia/Shanghai" (setup value), IANA id — used for daily stats/"today"
    language: string; // "zh-CN"
    favicon: string | null; // URL
    siteStartDate: string | null; // yyyy-MM-dd, default = setup date
  };
  profile: {
    avatar: string | null; // URL
    name: string; // admin nickname from setup
    bio: string; // ""
    email: string; // ""
    links: {
      name: string;
      icon: string /* iconify id, e.g. "fa6-brands:github" */;
      url: string;
    }[];
  };
  appearance: {
    themeHue: number; // 315, 0-360
    themeStyle:
      | "tonalSpot"
      | "vibrant"
      | "content"
      | "expressive"
      | "rainbow"
      | "fruitSalad"
      | "monochrome"
      | "neutral"
      | "fidelity"; // "tonalSpot"
    themeSpec: "2021" | "2025"; // "2025"
    defaultMode: "light" | "dark" | "system"; // "system"
    allowModeSwitch: boolean; // true
    backgroundMode: "banner" | "none"; // "banner"
    texture: {
      preset:
        | "none"
        | "starlight"
        | "cyberDots"
        | "topography"
        | "geometric"
        | "sakura"; // "none"
      opacity: number; // 0.12, 0.05-0.25
      allowMotion: boolean; // true
    };
    topAppBarAlign: "left" | "center"; // "center"
    progressIndicatorStyle: "dual" | "single"; // "dual"
    postList: {
      layout: "list" | "grid"; // "list"
      cover: "left" | "right"; // "right"
      cardWidth: "compact" | "regular" | "relaxed"; // "regular"
    };
  };
  banner: {
    desktop: string[]; // image URLs in carousel order; [] = no banner image
    mobile: string[]; // []
    position: "top" | "center" | "bottom"; // "center"
    height: "short" | "default" | "tall"; // "default"
    dim: { enable: boolean /* true */; opacity: number /* 0.24, 0-1 */ };
    homeText: {
      enable: boolean; // true
      title: string; // = siteName at setup
      subtitles: string[]; // []
      typewriter: {
        enable: boolean /* true */;
        speed: number /* 100 */;
        deleteSpeed: number /* 50 */;
        pauseTime: number /* 2000 */;
        loop: boolean; /* true */
      };
    };
    carousel: {
      enable: boolean; // true
      interval: number; // 6000, ≥ 3000 ms
      fadeDuration: number; // 1200
      animation:
        "kenBurns" | "zoomIn" | "zoomOut" | "panLeft" | "panRight" | "none"; // "kenBurns"
    };
    waves: boolean; // true
  };
  navigation: NavItem[];
  // default: home, archive, and "更多" (type url, empty target, icon material-symbols:apps-rounded)
  // with children categories, tags, series
  sidebar: {
    enable: boolean; // true
    arrangement: "single" | "dual"; // "dual"
    side: "left" | "right"; // "left" (for single)
    widgets: SidebarWidget[];
  };
  announcement: {
    enable: boolean; // false
    title: string; // ""
    content: string; // "" plain text (not HTML)
    closable: boolean; // true
    link: {
      enable: boolean /* false */;
      text: string;
      url: string;
      external: boolean; /* true */
    };
  };
  footer: { html: string }; // "" — TRUSTED admin HTML, may contain scripts, never sanitized
  seo: {
    titleSeparator: string; // " - "
    defaultDescription: string; // ""
    keywords: string[]; // []
    ogImage: string | null;
    twitterHandle: string; // ""
    extraRobots: string; // "" extra lines appended to robots.txt
  };
  analytics: {
    umami: {
      enable: boolean /* false */;
      shareUrl: string;
      websiteId: string;
      scriptUrl: string;
    };
  };
  // when umami.enable: scriptUrl must be absolute http(s) and websiteId non-empty
  article: {
    pageSize: number; // 8, 1-50 (default page size of GET /api/posts)
    toc: { enable: boolean /* true */; depth: number /* 2, 1-3 */ };
    lastUpdated: {
      enable: boolean /* true */;
      minimumAgeDays: number; /* 90, ≥ 0 */
    };
    discovery: {
      enable: boolean /* true */;
      relatedCount: number /* 3, 0-6 */;
      randomCount: number; /* 2, 0-6 */
    };
    share: { enable: boolean /* true */; includeCover: boolean /* true */ };
    seriesCardPosition: "top" | "bottom"; // "bottom"
  };
  dashboard: {
    // admin-only, NOT in bootstrap
    widgets: {
      id: string;
      x: number;
      y: number;
      w: number;
      h: number;
      visible: boolean;
    }[];
    // ids unique; x,y ≥ 0; w,h ≥ 1. Default ids: totalPosts, drafts, totalViews, todayViews, viewsTrend,
    // trash, database, popularPosts, recentPosts, runtime, cpu, memory, disk, mediaStorage (12-column grid)
  };
}

export type SidebarPage =
  | "home"
  | "archive"
  | "categories"
  | "tags"
  | "series"
  | "post"
  | "page"
  | "search"
  | "rss"
  | "notFound";

export interface SidebarWidget {
  type:
    | "profile"
    | "announcement"
    | "categories"
    | "tags"
    | "series"
    | "recentPosts"
    | "stats"
    | "toc";
  enable: boolean;
  slot: "top" | "sticky";
  column: "primary" | "secondary";
  pages: SidebarPage[]; // [] = all pages
  collapseAfter: number | null; // null or ≥ 1
}
// default widgets, in order: profile (top, primary, all); announcement (top, primary, [home]);
// categories (sticky, primary, collapse 5); series (sticky, primary, collapse 5);
// tags (sticky, primary, collapse 6); stats (top, secondary, [home, archive, categories, tags]);
// toc (sticky, secondary, [post]); recentPosts (disabled, sticky, secondary)

export interface NavItem {
  id: string; // unique across the whole tree
  label: string; // required
  icon: string | null;
  type:
    | "home"
    | "archive"
    | "categories"
    | "tags"
    | "series"
    | "rss"
    | "page"
    | "url";
  target: string; // custom page slug for "page" (required), URL for "url"
  // (required unless the item has children), "" otherwise
  openInNewTab: boolean;
  children: NavItem[]; // one level only: children must have children = []
}
