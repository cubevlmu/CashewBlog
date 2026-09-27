namespace CashewBlog.Domain.Entities;

public sealed class CustomPage
{
    public Guid Id { get; set; } = Guid.CreateVersion7();
    public string Title { get; set; } = "";

    /// <summary>May contain '/' for nested paths, e.g. <c>links/friends</c>.</summary>
    public string Slug { get; set; } = "";

    /// <summary>Sanitized HTML (scripts, event handlers and javascript: URLs removed).</summary>
    public string ContentHtml { get; set; } = "";
    public string? CustomCss { get; set; }
    public PageLayout Layout { get; set; } = PageLayout.Default;
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
}

public sealed class MediaAsset
{
    public Guid Id { get; set; } = Guid.CreateVersion7();
    public MediaKind Kind { get; set; }
    public string OriginalFileName { get; set; } = "";

    /// <summary>Server-generated file name of the original (without directory).</summary>
    public string StorageName { get; set; } = "";

    /// <summary>Paths are relative to the storage root and use '/' separators.</summary>
    public string OriginalPath { get; set; } = "";
    public string? OptimizedPath { get; set; }
    public string? ThumbnailPath { get; set; }
    public string MimeType { get; set; } = "application/octet-stream";
    public long SizeBytes { get; set; }
    public int? Width { get; set; }
    public int? Height { get; set; }
    public string? AltText { get; set; }
    public string? Sha256 { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
}

/// <summary>Records that an owner (post, page, settings) uses a media asset.</summary>
public sealed class MediaReference
{
    public Guid Id { get; set; } = Guid.CreateVersion7();
    public Guid MediaAssetId { get; set; }
    public MediaAsset MediaAsset { get; set; } = null!;
    public MediaOwnerType OwnerType { get; set; }

    /// <summary>Null for the singleton SiteSettings owner.</summary>
    public Guid? OwnerId { get; set; }

    /// <summary>cover, body, workingCopy, html, css, avatar, banner, favicon, ...</summary>
    public string FieldKey { get; set; } = "";
}

/// <summary>Singleton (Id = 1) typed-JSON settings document.</summary>
public sealed class SiteSettingsRecord
{
    public const int SingletonId = 1;
    public int Id { get; set; } = SingletonId;
    public int SchemaVersion { get; set; }
    public string Data { get; set; } = "{}";
    public DateTimeOffset UpdatedAt { get; set; }
}

public sealed class PostDailyStat
{
    public Guid PostId { get; set; }
    public DateOnly Date { get; set; }
    public long Views { get; set; }
}

public sealed class PostViewDedupe
{
    public Guid PostId { get; set; }
    public string VisitorHash { get; set; } = "";
    public DateTimeOffset ExpiresAt { get; set; }
}
