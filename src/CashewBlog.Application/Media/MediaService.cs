using System.Security.Cryptography;
using System.Text.RegularExpressions;
using CashewBlog.Application.Abstractions;
using CashewBlog.Application.Common;
using CashewBlog.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace CashewBlog.Application.Media;

public sealed record MediaAssetDto(
    Guid Id,
    MediaKind Kind,
    string OriginalFileName,
    string MimeType,
    long SizeBytes,
    int? Width,
    int? Height,
    string? AltText,
    string? Sha256,
    DateTimeOffset CreatedAt,
    string Url,
    string OriginalUrl,
    string? DisplayUrl,
    string? ThumbUrl,
    int ReferenceCount);

public sealed record MediaQuery(MediaKind? Kind, string? Q, string? Sort, int? Page, int? PageSize);

public sealed record UpdateMediaRequest(string? AltText);

public sealed record MediaReferenceDto(MediaOwnerType OwnerType, Guid? OwnerId, string Title, string? Slug, string FieldKey, bool InTrash);

public sealed record UploadInput(Stream Content, string FileName, string? ContentType, string? AltText);

public sealed partial class MediaService(IApplicationDbContext db, IClock clock, IMediaStorage storage, IImageProcessor images)
{
    public const int DisplayMaxEdge = 2560;
    public const int DisplayQuality = 82;
    public const int ThumbMaxEdge = 384;
    public const int ThumbQuality = 75;

    public async Task<PagedResult<MediaAssetDto>> ListAsync(MediaQuery query, CancellationToken ct)
    {
        var (page, pageSize) = Paging.Normalize(query.Page, query.PageSize, 30, 200);
        var assets = db.MediaAssets.AsNoTracking();
        if (query.Kind is { } kind)
        {
            assets = assets.Where(m => m.Kind == kind);
        }

        if (!string.IsNullOrWhiteSpace(query.Q))
        {
            var q = query.Q.Trim().ToLower();
            assets = assets.Where(m => m.OriginalFileName.ToLower().Contains(q) || (m.AltText != null && m.AltText.ToLower().Contains(q)));
        }

        assets = query.Sort switch
        {
            "createdAt" or "oldest" => assets.OrderBy(m => m.CreatedAt),
            "name" => assets.OrderBy(m => m.OriginalFileName),
            "size" => assets.OrderByDescending(m => m.SizeBytes),
            _ => assets.OrderByDescending(m => m.CreatedAt),
        };

        var rows = await assets
            .Select(m => new { Asset = m, Refs = db.MediaReferences.Count(r => r.MediaAssetId == m.Id) })
            .ToPagedAsync(page, pageSize, ct);
        return new PagedResult<MediaAssetDto>(rows.Items.Select(r => ToDto(r.Asset, r.Refs)).ToList(), rows.Page, rows.PageSize, rows.TotalItems);
    }

    public async Task<MediaAssetDto> GetAsync(Guid id, CancellationToken ct)
    {
        var asset = await db.MediaAssets.AsNoTracking().FirstOrDefaultAsync(m => m.Id == id, ct) ?? throw new NotFoundException("Media not found.");
        return ToDto(asset, await db.MediaReferences.CountAsync(r => r.MediaAssetId == id, ct));
    }

    /// <summary>
    /// Stores an upload. Anything the image decoder accepts becomes an Image (original +
    /// WebP display + WebP thumbnail); everything else is stored as an Attachment.
    /// <paramref name="input"/>.Content must be seekable.
    /// </summary>
    public async Task<MediaAssetDto> UploadAsync(UploadInput input, CancellationToken ct)
    {
        var stream = input.Content;
        if (!stream.CanSeek)
        {
            throw new InvalidOperationException("Upload stream must be seekable.");
        }

        if (stream.Length == 0)
        {
            throw new ValidationException("file", "The file is empty.");
        }

        var fileName = CleanFileName(input.FileName);
        stream.Position = 0;
        var sha = Convert.ToHexStringLower(await SHA256.HashDataAsync(stream, ct));
        stream.Position = 0;
        var probe = await images.ProbeAsync(stream, ct);

        var now = clock.UtcNow;
        var asset = new MediaAsset
        {
            OriginalFileName = fileName,
            SizeBytes = stream.Length,
            Sha256 = sha,
            AltText = string.IsNullOrWhiteSpace(input.AltText) ? null : input.AltText.Trim(),
            CreatedAt = now,
        };
        var dir = $"{now.UtcDateTime:yyyy}/{now.UtcDateTime:MM}";
        var written = new List<string>();

        try
        {
            if (probe is not null)
            {
                asset.Kind = MediaKind.Image;
                asset.MimeType = probe.MimeType;
                asset.Width = probe.Width;
                asset.Height = probe.Height;
                asset.StorageName = $"{asset.Id}-original{probe.Extension}";
                asset.OriginalPath = $"{dir}/{asset.StorageName}";
                await SaveAsync(asset.OriginalPath, stream, written, ct);

                stream.Position = 0;
                var display = await images.CreateWebPAsync(stream, DisplayMaxEdge, DisplayQuality, ct);
                await using (display.Content)
                {
                    asset.OptimizedPath = $"{dir}/{asset.Id}-display.webp";
                    await SaveAsync(asset.OptimizedPath, display.Content, written, ct);
                }

                stream.Position = 0;
                var thumb = await images.CreateWebPAsync(stream, ThumbMaxEdge, ThumbQuality, ct);
                await using (thumb.Content)
                {
                    asset.ThumbnailPath = $"{dir}/{asset.Id}-thumb.webp";
                    await SaveAsync(asset.ThumbnailPath, thumb.Content, written, ct);
                }
            }
            else
            {
                asset.Kind = MediaKind.Attachment;
                asset.MimeType = CleanContentType(input.ContentType);
                asset.StorageName = $"{asset.Id}{SafeExtension(fileName)}";
                asset.OriginalPath = $"{dir}/{asset.StorageName}";
                stream.Position = 0;
                await SaveAsync(asset.OriginalPath, stream, written, ct);
            }

            db.MediaAssets.Add(asset);
            await db.SaveChangesAsync(ct);
        }
        catch
        {
            foreach (var path in written)
            {
                await storage.DeleteAsync(path, CancellationToken.None);
            }

            throw;
        }

        return ToDto(asset, 0);
    }

    public async Task<MediaAssetDto> UpdateAsync(Guid id, UpdateMediaRequest request, CancellationToken ct)
    {
        var asset = await db.MediaAssets.FirstOrDefaultAsync(m => m.Id == id, ct) ?? throw new NotFoundException("Media not found.");
        if ((request.AltText?.Length ?? 0) > 500)
        {
            throw new ValidationException("altText", "Max 500 characters.");
        }

        asset.AltText = string.IsNullOrWhiteSpace(request.AltText) ? null : request.AltText.Trim();
        await db.SaveChangesAsync(ct);
        return ToDto(asset, await db.MediaReferences.CountAsync(r => r.MediaAssetId == id, ct));
    }

    /// <summary>Deletes the asset and its files, or throws 409 <c>media_in_use</c> listing the references.</summary>
    public async Task DeleteAsync(Guid id, CancellationToken ct)
    {
        var asset = await db.MediaAssets.FirstOrDefaultAsync(m => m.Id == id, ct) ?? throw new NotFoundException("Media not found.");
        var references = await GetReferencesAsync(id, ct);
        if (references.Count > 0)
        {
            throw new ConflictException("media_in_use", "The media asset is still referenced.", new { references });
        }

        db.MediaAssets.Remove(asset);
        await db.SaveChangesAsync(ct);

        foreach (var path in new[] { asset.OriginalPath, asset.OptimizedPath, asset.ThumbnailPath })
        {
            if (path is not null)
            {
                await storage.DeleteAsync(path, ct);
            }
        }
    }

    public async Task<List<MediaReferenceDto>> GetReferencesAsync(Guid id, CancellationToken ct)
    {
        if (!await db.MediaAssets.AnyAsync(m => m.Id == id, ct))
        {
            throw new NotFoundException("Media not found.");
        }

        var refs = await db.MediaReferences.AsNoTracking().Where(r => r.MediaAssetId == id).ToListAsync(ct);
        var postIds = refs.Where(r => r.OwnerType == MediaOwnerType.Post && r.OwnerId != null).Select(r => r.OwnerId!.Value).ToList();
        var pageIds = refs.Where(r => r.OwnerType == MediaOwnerType.CustomPage && r.OwnerId != null).Select(r => r.OwnerId!.Value).ToList();
        var posts = await db.Posts.IgnoreQueryFilters().Where(p => postIds.Contains(p.Id))
            .Select(p => new { p.Id, p.Title, p.Slug, Deleted = p.DeletedAt != null })
            .ToDictionaryAsync(p => p.Id, ct);
        var pages = await db.CustomPages.Where(p => pageIds.Contains(p.Id))
            .Select(p => new { p.Id, p.Title, p.Slug })
            .ToDictionaryAsync(p => p.Id, ct);

        return refs.Select(r => r.OwnerType switch
            {
                MediaOwnerType.Post when r.OwnerId is { } pid && posts.TryGetValue(pid, out var p) =>
                    new MediaReferenceDto(r.OwnerType, r.OwnerId, p.Title, p.Slug, r.FieldKey, p.Deleted),
                MediaOwnerType.CustomPage when r.OwnerId is { } gid && pages.TryGetValue(gid, out var g) =>
                    new MediaReferenceDto(r.OwnerType, r.OwnerId, g.Title, g.Slug, r.FieldKey, false),
                MediaOwnerType.SiteSettings => new MediaReferenceDto(r.OwnerType, null, "Site settings", null, r.FieldKey, false),
                _ => new MediaReferenceDto(r.OwnerType, r.OwnerId, "(unknown)", null, r.FieldKey, false),
            })
            .OrderBy(r => r.OwnerType).ThenBy(r => r.Title)
            .ToList();
    }

    private async Task SaveAsync(string path, Stream content, List<string> written, CancellationToken ct)
    {
        written.Add(path);
        await storage.SaveAsync(path, content, ct);
    }

    public static MediaAssetDto ToDto(MediaAsset m, int referenceCount) => new(
        m.Id,
        m.Kind,
        m.OriginalFileName,
        m.MimeType,
        m.SizeBytes,
        m.Width,
        m.Height,
        m.AltText,
        m.Sha256,
        m.CreatedAt,
        MediaUrls.For(m.OptimizedPath ?? m.OriginalPath),
        MediaUrls.For(m.OriginalPath),
        MediaUrls.ForOptional(m.OptimizedPath),
        MediaUrls.ForOptional(m.ThumbnailPath),
        referenceCount);

    [GeneratedRegex(@"^\.[A-Za-z0-9]{1,10}$", RegexOptions.CultureInvariant)]
    private static partial Regex SafeExtensionRegex();

    [GeneratedRegex(@"^[A-Za-z0-9!#$&^_.+-]+/[A-Za-z0-9!#$&^_.+-]+$", RegexOptions.CultureInvariant)]
    private static partial Regex ContentTypeRegex();

    /// <summary>Lower-cased extension if it is plain alphanumeric, otherwise empty.</summary>
    public static string SafeExtension(string fileName)
    {
        var ext = Path.GetExtension(fileName);
        return SafeExtensionRegex().IsMatch(ext) ? ext.ToLowerInvariant() : "";
    }

    private static string CleanFileName(string? name)
    {
        // Browsers may send a path; keep only the last segment, and cap the length.
        var fileName = (name ?? "").Replace('\\', '/').Split('/').Last().Trim();
        fileName = new string(fileName.Where(c => !char.IsControl(c)).ToArray());
        if (fileName.Length == 0)
        {
            fileName = "file";
        }

        return fileName.Length > 255 ? fileName[^255..] : fileName;
    }

    private static string CleanContentType(string? contentType)
    {
        var value = contentType?.Split(';')[0].Trim().ToLowerInvariant();
        return value is not null && ContentTypeRegex().IsMatch(value) ? value : "application/octet-stream";
    }
}
