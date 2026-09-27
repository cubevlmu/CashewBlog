using CashewBlog.Application.Setup;
using CashewBlog.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace CashewBlog.Application.Abstractions;

/// <summary>EF Core unit of work exposed to use cases. Implemented by Infrastructure.</summary>
public interface IApplicationDbContext
{
    DbSet<Post> Posts { get; }
    DbSet<Category> Categories { get; }
    DbSet<Tag> Tags { get; }
    DbSet<PostTag> PostTags { get; }
    DbSet<Series> Series { get; }
    DbSet<CustomPage> CustomPages { get; }
    DbSet<MediaAsset> MediaAssets { get; }
    DbSet<MediaReference> MediaReferences { get; }
    DbSet<PostDailyStat> PostDailyStats { get; }
    DbSet<PostViewDedupe> PostViewDedupes { get; }
    DbSet<SiteSettingsRecord> SiteSettings { get; }

    Task<int> SaveChangesAsync(CancellationToken cancellationToken = default);
}

public interface IClock
{
    DateTimeOffset UtcNow { get; }
}

/// <summary>Converts canonical Markdown into plain text for search, excerpts and word counts.</summary>
public interface IMarkdownTextExtractor
{
    string ToPlainText(string markdown);
}

/// <summary>Custom Page HTML sanitizer (no scripts, event handlers or javascript: URLs).</summary>
public interface IHtmlSanitizerService
{
    string Sanitize(string html);

    /// <summary>Strips HTML to plain text (for search over custom pages, excerpts).</summary>
    string ToPlainText(string html);
}

public interface IPasswordHasher
{
    string Hash(string password);
    bool Verify(string password, string encodedHash);
}

/// <summary>Persistent operator configuration (<c>{DataDir}/config.json</c>).</summary>
public interface IConfigStore
{
    string DataDirectory { get; }
    AppConfig? Current { get; }
    bool IsInitialized { get; }

    /// <summary>Npgsql connection string for the configured database, or null when not initialized.</summary>
    string? ConnectionString { get; }

    /// <summary>Absolute path of the uploads root (config value or default).</summary>
    string StorageRoot { get; }
    long MaxUploadBytes { get; }

    /// <summary>Atomically writes the config (temp file + rename) and switches the runtime to it.</summary>
    Task SaveAsync(AppConfig config, CancellationToken cancellationToken = default);
}

/// <summary>Local filesystem storage for uploads. Paths are relative, '/'-separated.</summary>
public interface IMediaStorage
{
    string RootPath { get; }
    Task SaveAsync(string relativePath, Stream content, CancellationToken cancellationToken = default);
    Task DeleteAsync(string relativePath, CancellationToken cancellationToken = default);

    /// <summary>Resolves a request path to a physical file under the root; null if outside root or missing.</summary>
    string? ResolveExisting(string relativePath);
    long GetUsageBytes();
}

public sealed record ImageProbe(int Width, int Height, string MimeType, string Extension);

public sealed record ImageVariant(Stream Content, int Width, int Height);

public interface IImageProcessor
{
    /// <summary>Returns image info when the stream is a decodable image; otherwise null.</summary>
    Task<ImageProbe?> ProbeAsync(Stream stream, CancellationToken cancellationToken = default);

    /// <summary>Encodes a WebP version whose longest edge is at most <paramref name="maxEdge"/>.</summary>
    Task<ImageVariant> CreateWebPAsync(Stream source, int maxEdge, int quality, CancellationToken cancellationToken = default);
}

/// <summary>Invalidation hook for public read caches (bootstrap etc.).</summary>
public interface IPublicCache
{
    void Invalidate();
}
