namespace CashewBlog.Application.Settings;

// ---------------------------------------------------------------------------------------
// Typed site settings, persisted as one JSONB document (SiteSettings.Data). The shape
// mirrors the Shirone frontend configuration so the SSR layer can map it 1:1.
//
// Conventions:
//  * Every property has a default, so missing JSON properties deserialize to sane values;
//    adding a field is backwards compatible without a schema migration.
//  * Renaming/removing a field: bump CurrentSchemaVersion and add a step in
//    SettingsService.Migrate.
//  * JSON is camelCase; enums are camelCase strings (unknown values are rejected with 400).
// ---------------------------------------------------------------------------------------

public sealed record SiteSettings
{
    public const int CurrentSchemaVersion = 1;

    public int SchemaVersion { get; init; } = CurrentSchemaVersion;
    public GeneralSettings General { get; init; } = new();
    public ProfileSettings Profile { get; init; } = new();
    public AppearanceSettings Appearance { get; init; } = new();
    public BannerSettings Banner { get; init; } = new();
    public List<NavItem> Navigation { get; init; } = NavItem.Defaults();
    public SidebarSettings Sidebar { get; init; } = new();
    public AnnouncementSettings Announcement { get; init; } = new();
    public FooterSettings Footer { get; init; } = new();
    public SeoSettings Seo { get; init; } = new();
    public AnalyticsSettings Analytics { get; init; } = new();
    public ArticleSettings Article { get; init; } = new();

    /// <summary>Admin-only; never included in the public bootstrap.</summary>
    public DashboardSettings Dashboard { get; init; } = new();

    /// <summary>JSON names of the top-level sections (used by reset/{section} and partial PUT).</summary>
    public static readonly IReadOnlyList<string> SectionNames =
    [
        "general", "profile", "appearance", "banner", "navigation", "sidebar",
        "announcement", "footer", "seo", "analytics", "article", "dashboard",
    ];
}

// ----------------------------------------------------------------------------- general

public sealed record GeneralSettings
{
    public string SiteName { get; init; } = "CashewBlog";
    public string SiteUrl { get; init; } = "http://localhost:8080/";
    public string Subtitle { get; init; } = "";
    public string Description { get; init; } = "";
    public List<string> Keywords { get; init; } = [];

    /// <summary>IANA time zone id; used for daily view stats and date grouping.</summary>
    public string Timezone { get; init; } = "Asia/Shanghai";
    public string Language { get; init; } = "zh-CN";
    public string? Favicon { get; init; }

    /// <summary>yyyy-MM-dd; defaults to the setup date.</summary>
    public string? SiteStartDate { get; init; }
}

// ----------------------------------------------------------------------------- profile

public sealed record ProfileSettings
{
    public string? Avatar { get; init; }
    public string Name { get; init; } = "Admin";
    public string Bio { get; init; } = "";
    public string Email { get; init; } = "";
    public List<ProfileLink> Links { get; init; } = [];
}

public sealed record ProfileLink
{
    public string Name { get; init; } = "";

    /// <summary>Iconify id, e.g. "fa6-brands:github".</summary>
    public string Icon { get; init; } = "";
    public string Url { get; init; } = "";
}

// -------------------------------------------------------------------------- appearance

public enum ThemeStyle { TonalSpot, Vibrant, Content, Expressive, Rainbow, FruitSalad, Monochrome, Neutral, Fidelity }

public enum ThemeMode { Light, Dark, System }

public enum BackgroundMode { Banner, None }

public enum TexturePreset { None, Starlight, CyberDots, Topography, Geometric, Sakura }

public enum TopAppBarAlign { Left, Center }

public enum ProgressIndicatorStyle { Dual, Single }

public enum PostListLayout { List, Grid }

public enum CoverSide { Left, Right }

public enum CardWidth { Compact, Regular, Relaxed }

public sealed record AppearanceSettings
{
    /// <summary>0-360.</summary>
    public int ThemeHue { get; init; } = 315;
    public ThemeStyle ThemeStyle { get; init; } = ThemeStyle.TonalSpot;

    /// <summary>"2021" or "2025".</summary>
    public string ThemeSpec { get; init; } = "2025";
    public ThemeMode DefaultMode { get; init; } = ThemeMode.System;
    public bool AllowModeSwitch { get; init; } = true;
    public BackgroundMode BackgroundMode { get; init; } = BackgroundMode.Banner;
    public TextureSettings Texture { get; init; } = new();
    public TopAppBarAlign TopAppBarAlign { get; init; } = TopAppBarAlign.Center;
    public ProgressIndicatorStyle ProgressIndicatorStyle { get; init; } = ProgressIndicatorStyle.Dual;
    public PostListSettings PostList { get; init; } = new();
}

public sealed record TextureSettings
{
    public TexturePreset Preset { get; init; } = TexturePreset.None;

    /// <summary>0.05-0.25.</summary>
    public double Opacity { get; init; } = 0.12;
    public bool AllowMotion { get; init; } = true;
}

public sealed record PostListSettings
{
    public PostListLayout Layout { get; init; } = PostListLayout.List;
    public CoverSide Cover { get; init; } = CoverSide.Right;
    public CardWidth CardWidth { get; init; } = CardWidth.Regular;
}

// ------------------------------------------------------------------------------ banner

public enum BannerPosition { Top, Center, Bottom }

public enum BannerHeight { Short, Default, Tall }

public enum BannerAnimation { KenBurns, ZoomIn, ZoomOut, PanLeft, PanRight, None }

public sealed record BannerSettings
{
    /// <summary>Image URLs in carousel order; empty = no banner image.</summary>
    public List<string> Desktop { get; init; } = [];
    public List<string> Mobile { get; init; } = [];
    public BannerPosition Position { get; init; } = BannerPosition.Center;
    public BannerHeight Height { get; init; } = BannerHeight.Default;
    public BannerDim Dim { get; init; } = new();
    public BannerHomeText HomeText { get; init; } = new();
    public BannerCarousel Carousel { get; init; } = new();
    public bool Waves { get; init; } = true;
}

public sealed record BannerDim
{
    public bool Enable { get; init; } = true;

    /// <summary>0-1.</summary>
    public double Opacity { get; init; } = 0.24;
}

public sealed record BannerHomeText
{
    public bool Enable { get; init; } = true;

    /// <summary>Defaults to the site name.</summary>
    public string Title { get; init; } = "CashewBlog";
    public List<string> Subtitles { get; init; } = [];
    public TypewriterSettings Typewriter { get; init; } = new();
}

public sealed record TypewriterSettings
{
    public bool Enable { get; init; } = true;
    public int Speed { get; init; } = 100;
    public int DeleteSpeed { get; init; } = 50;
    public int PauseTime { get; init; } = 2000;
    public bool Loop { get; init; } = true;
}

public sealed record BannerCarousel
{
    public bool Enable { get; init; } = true;

    /// <summary>Milliseconds, &gt;= 3000.</summary>
    public int Interval { get; init; } = 6000;
    public int FadeDuration { get; init; } = 1200;
    public BannerAnimation Animation { get; init; } = BannerAnimation.KenBurns;
}

// -------------------------------------------------------------------------- navigation

public enum NavItemType { Home, Archive, Categories, Tags, Series, Rss, Page, Url }

public sealed record NavItem
{
    public string Id { get; init; } = "";
    public string Label { get; init; } = "";
    public string? Icon { get; init; }
    public NavItemType Type { get; init; } = NavItemType.Url;

    /// <summary>Custom page slug for <c>page</c>, URL for <c>url</c>, "" otherwise.</summary>
    public string Target { get; init; } = "";
    public bool OpenInNewTab { get; init; }

    /// <summary>One level only: children must have no children.</summary>
    public List<NavItem> Children { get; init; } = [];

    public static List<NavItem> Defaults() =>
    [
        new() { Id = "home", Label = "首页", Icon = "material-symbols:home-rounded", Type = NavItemType.Home },
        new() { Id = "archive", Label = "归档", Icon = "material-symbols:archive-rounded", Type = NavItemType.Archive },
        new()
        {
            Id = "more",
            Label = "更多",
            Icon = "material-symbols:apps-rounded",
            Type = NavItemType.Url,
            Children =
            [
                new() { Id = "categories", Label = "分类", Icon = "material-symbols:folder-rounded", Type = NavItemType.Categories },
                new() { Id = "tags", Label = "标签", Icon = "material-symbols:sell-rounded", Type = NavItemType.Tags },
                new() { Id = "series", Label = "系列", Icon = "material-symbols:library-books-rounded", Type = NavItemType.Series },
            ],
        },
    ];
}

// ----------------------------------------------------------------------------- sidebar

public enum SidebarArrangement { Single, Dual }

public enum SidebarSide { Left, Right }

public enum SidebarWidgetType { Profile, Announcement, Categories, Tags, Series, RecentPosts, Stats, Toc }

public enum SidebarSlot { Top, Sticky }

public enum SidebarColumn { Primary, Secondary }

public enum SidebarPage { Home, Archive, Categories, Tags, Series, Post, Page, Search, Rss, NotFound }

public sealed record SidebarSettings
{
    public bool Enable { get; init; } = true;
    public SidebarArrangement Arrangement { get; init; } = SidebarArrangement.Dual;

    /// <summary>Which side the single column sits on when <see cref="Arrangement"/> is single.</summary>
    public SidebarSide Side { get; init; } = SidebarSide.Left;
    public List<SidebarWidget> Widgets { get; init; } = SidebarWidget.Defaults();
}

public sealed record SidebarWidget
{
    public SidebarWidgetType Type { get; init; }
    public bool Enable { get; init; } = true;
    public SidebarSlot Slot { get; init; } = SidebarSlot.Top;
    public SidebarColumn Column { get; init; } = SidebarColumn.Primary;

    /// <summary>Empty = all pages.</summary>
    public List<SidebarPage> Pages { get; init; } = [];
    public int? CollapseAfter { get; init; }

    public static List<SidebarWidget> Defaults() =>
    [
        new() { Type = SidebarWidgetType.Profile, Slot = SidebarSlot.Top, Column = SidebarColumn.Primary },
        new() { Type = SidebarWidgetType.Announcement, Slot = SidebarSlot.Top, Column = SidebarColumn.Primary, Pages = [SidebarPage.Home] },
        new() { Type = SidebarWidgetType.Categories, Slot = SidebarSlot.Sticky, Column = SidebarColumn.Primary, CollapseAfter = 5 },
        new() { Type = SidebarWidgetType.Series, Slot = SidebarSlot.Sticky, Column = SidebarColumn.Primary, CollapseAfter = 5 },
        new() { Type = SidebarWidgetType.Tags, Slot = SidebarSlot.Sticky, Column = SidebarColumn.Primary, CollapseAfter = 6 },
        new()
        {
            Type = SidebarWidgetType.Stats,
            Slot = SidebarSlot.Top,
            Column = SidebarColumn.Secondary,
            Pages = [SidebarPage.Home, SidebarPage.Archive, SidebarPage.Categories, SidebarPage.Tags],
        },
        new() { Type = SidebarWidgetType.Toc, Slot = SidebarSlot.Sticky, Column = SidebarColumn.Secondary, Pages = [SidebarPage.Post] },
        new() { Type = SidebarWidgetType.RecentPosts, Enable = false, Slot = SidebarSlot.Sticky, Column = SidebarColumn.Secondary },
    ];
}

// ------------------------------------------------------------------------ announcement

public sealed record AnnouncementSettings
{
    public bool Enable { get; init; }
    public string Title { get; init; } = "";

    /// <summary>Plain text (not HTML).</summary>
    public string Content { get; init; } = "";
    public bool Closable { get; init; } = true;
    public AnnouncementLink Link { get; init; } = new();
}

public sealed record AnnouncementLink
{
    public bool Enable { get; init; }
    public string Text { get; init; } = "";
    public string Url { get; init; } = "";
    public bool External { get; init; } = true;
}

// ------------------------------------------------------------------------------ footer

public sealed record FooterSettings
{
    /// <summary>Trusted administrator HTML; may contain scripts. Never sanitized.</summary>
    public string Html { get; init; } = "";
}

// --------------------------------------------------------------------------------- seo

public sealed record SeoSettings
{
    public string TitleSeparator { get; init; } = " - ";
    public string DefaultDescription { get; init; } = "";
    public List<string> Keywords { get; init; } = [];
    public string? OgImage { get; init; }
    public string TwitterHandle { get; init; } = "";

    /// <summary>Extra lines appended to robots.txt.</summary>
    public string ExtraRobots { get; init; } = "";
}

// --------------------------------------------------------------------------- analytics

public sealed record AnalyticsSettings
{
    public UmamiSettings Umami { get; init; } = new();
}

public sealed record UmamiSettings
{
    public bool Enable { get; init; }
    public string ShareUrl { get; init; } = "";
    public string WebsiteId { get; init; } = "";
    public string ScriptUrl { get; init; } = "";
}

// ----------------------------------------------------------------------------- article

public enum SeriesCardPosition { Top, Bottom }

public sealed record ArticleSettings
{
    /// <summary>1-50.</summary>
    public int PageSize { get; init; } = 8;
    public TocSettings Toc { get; init; } = new();
    public LastUpdatedSettings LastUpdated { get; init; } = new();
    public DiscoverySettings Discovery { get; init; } = new();
    public ShareSettings Share { get; init; } = new();
    public SeriesCardPosition SeriesCardPosition { get; init; } = SeriesCardPosition.Bottom;
}

public sealed record TocSettings
{
    public bool Enable { get; init; } = true;

    /// <summary>1-3.</summary>
    public int Depth { get; init; } = 2;
}

public sealed record LastUpdatedSettings
{
    public bool Enable { get; init; } = true;
    public int MinimumAgeDays { get; init; } = 90;
}

public sealed record DiscoverySettings
{
    public bool Enable { get; init; } = true;

    /// <summary>0-6.</summary>
    public int RelatedCount { get; init; } = 3;

    /// <summary>0-6.</summary>
    public int RandomCount { get; init; } = 2;
}

public sealed record ShareSettings
{
    public bool Enable { get; init; } = true;
    public bool IncludeCover { get; init; } = true;
}

// --------------------------------------------------------------------------- dashboard

public sealed record DashboardSettings
{
    public List<DashboardWidget> Widgets { get; init; } = DefaultWidgets();

    public static List<DashboardWidget> DefaultWidgets()
    {
        // 12-column grid: a row of four stat tiles, then charts/lists, then system tiles.
        return
        [
            new() { Id = "totalPosts", X = 0, Y = 0, W = 3, H = 2 },
            new() { Id = "drafts", X = 3, Y = 0, W = 3, H = 2 },
            new() { Id = "totalViews", X = 6, Y = 0, W = 3, H = 2 },
            new() { Id = "todayViews", X = 9, Y = 0, W = 3, H = 2 },
            new() { Id = "viewsTrend", X = 0, Y = 2, W = 8, H = 4 },
            new() { Id = "trash", X = 8, Y = 2, W = 4, H = 2 },
            new() { Id = "database", X = 8, Y = 4, W = 4, H = 2 },
            new() { Id = "popularPosts", X = 0, Y = 6, W = 6, H = 5 },
            new() { Id = "recentPosts", X = 6, Y = 6, W = 6, H = 5 },
            new() { Id = "runtime", X = 0, Y = 11, W = 3, H = 3 },
            new() { Id = "cpu", X = 3, Y = 11, W = 3, H = 3 },
            new() { Id = "memory", X = 6, Y = 11, W = 3, H = 3 },
            new() { Id = "disk", X = 9, Y = 11, W = 3, H = 3 },
            new() { Id = "mediaStorage", X = 0, Y = 14, W = 3, H = 2 },
        ];
    }
}

public sealed record DashboardWidget
{
    public string Id { get; init; } = "";
    public int X { get; init; }
    public int Y { get; init; }
    public int W { get; init; } = 3;
    public int H { get; init; } = 2;
    public bool Visible { get; init; } = true;
}
