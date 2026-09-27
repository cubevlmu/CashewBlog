using System.Linq.Expressions;
using CashewBlog.Application.Media;
using CashewBlog.Domain.Entities;

namespace CashewBlog.Application.Posts;

/// <summary>
/// Flat projection of a post without its content, translated to SQL by EF.
/// Mapping to DTOs (URL building, fallbacks) happens in memory.
/// </summary>
public sealed class PostRow
{
    public Guid Id { get; init; }
    public string Slug { get; init; } = "";
    public string Title { get; init; } = "";
    public string? Description { get; init; }
    public string Excerpt { get; init; } = "";
    public PostStatus Status { get; init; }
    public MediaRow? Cover { get; init; }
    // The post's own category (admin views).
    public Guid? CategoryId { get; init; }
    public string? CategoryName { get; init; }
    public string? CategorySlug { get; init; }

    // Effective category (public views): own category, else the series' default category.
    public Guid? EffectiveCategoryId { get; init; }
    public string? EffectiveCategoryName { get; init; }
    public string? EffectiveCategorySlug { get; init; }
    public Guid? SeriesId { get; init; }
    public string? SeriesTitle { get; init; }
    public string? SeriesSlug { get; init; }
    public int? SeriesOrder { get; init; }
    public List<AdminTagRef> Tags { get; init; } = [];
    public bool IsPinned { get; init; }
    public bool HasWorkingCopy { get; init; }
    public int WordCount { get; init; }
    public long ViewCount { get; init; }
    public DateTimeOffset CreatedAt { get; init; }
    public DateTimeOffset UpdatedAt { get; init; }
    public DateTimeOffset? PublishedAt { get; init; }
    public DateTimeOffset? DeletedAt { get; init; }
    public DateTimeOffset? PurgeAt { get; init; }
}

public sealed class MediaRow
{
    public string OriginalPath { get; init; } = "";
    public string? OptimizedPath { get; init; }
    public string? ThumbnailPath { get; init; }
    public int? Width { get; init; }
    public int? Height { get; init; }
    public string? AltText { get; init; }
}

public static class PostProjections
{
    public static readonly Expression<Func<Post, PostRow>> Row = p => new PostRow
    {
        Id = p.Id,
        Slug = p.Slug,
        Title = p.Title,
        Description = p.Description,
        Excerpt = p.Excerpt,
        Status = p.Status,
        Cover = p.CoverMedia == null
            ? null
            : new MediaRow
            {
                OriginalPath = p.CoverMedia.OriginalPath,
                OptimizedPath = p.CoverMedia.OptimizedPath,
                ThumbnailPath = p.CoverMedia.ThumbnailPath,
                Width = p.CoverMedia.Width,
                Height = p.CoverMedia.Height,
                AltText = p.CoverMedia.AltText,
            },
        CategoryId = p.CategoryId,
        CategoryName = p.Category == null ? null : p.Category.Name,
        CategorySlug = p.Category == null ? null : p.Category.Slug,
        EffectiveCategoryId = p.CategoryId != null ? p.CategoryId : (p.Series != null ? p.Series.DefaultCategoryId : null),
        EffectiveCategoryName = p.Category != null
            ? p.Category.Name
            : (p.Series != null && p.Series.DefaultCategory != null ? p.Series.DefaultCategory.Name : null),
        EffectiveCategorySlug = p.Category != null
            ? p.Category.Slug
            : (p.Series != null && p.Series.DefaultCategory != null ? p.Series.DefaultCategory.Slug : null),
        SeriesId = p.SeriesId,
        SeriesTitle = p.Series == null ? null : p.Series.Title,
        SeriesSlug = p.Series == null ? null : p.Series.Slug,
        SeriesOrder = p.SeriesOrder,
        Tags = p.PostTags.OrderBy(pt => pt.Tag.Name).Select(pt => new AdminTagRef(pt.Tag.Id, pt.Tag.Name, pt.Tag.Slug)).ToList(),
        IsPinned = p.IsPinned,
        HasWorkingCopy = p.EditingContentMarkdown != null,
        WordCount = p.WordCount,
        ViewCount = p.ViewCount,
        CreatedAt = p.CreatedAt,
        UpdatedAt = p.UpdatedAt,
        PublishedAt = p.PublishedAt,
        DeletedAt = p.DeletedAt,
        PurgeAt = p.PurgeAt,
    };

    /// <summary>URL of the display WebP (original for non-images); width/height are those of the display image.</summary>
    public static CoverDto? ToCover(this MediaRow? m) => m is null
        ? null
        : BuildCover(m.OriginalPath, m.OptimizedPath, m.ThumbnailPath, m.Width, m.Height, m.AltText);

    public static CoverDto? ToCover(this MediaAsset? m) => m is null
        ? null
        : BuildCover(m.OriginalPath, m.OptimizedPath, m.ThumbnailPath, m.Width, m.Height, m.AltText);

    private static CoverDto BuildCover(string original, string? optimized, string? thumb, int? width, int? height, string? alt)
    {
        var (w, h) = optimized is null ? (width, height) : MediaDimensions.Display(width, height);
        return new CoverDto(MediaUrls.For(optimized ?? original), MediaUrls.ForOptional(thumb), w, h, alt);
    }

    public static PostSummaryDto ToSummary(this PostRow r) => new(
        r.Id,
        r.Slug,
        r.Title,
        string.IsNullOrWhiteSpace(r.Description) ? r.Excerpt : r.Description,
        r.Cover.ToCover(),
        r.EffectiveCategoryName is null ? null : new TermRef(r.EffectiveCategoryName, r.EffectiveCategorySlug!),
        r.Tags.Select(t => new TermRef(t.Name, t.Slug)).ToList(),
        r.SeriesTitle is null ? null : new SeriesRef(r.SeriesTitle, r.SeriesSlug!, r.SeriesOrder),
        r.IsPinned,
        r.PublishedAt,
        r.UpdatedAt,
        r.WordCount,
        r.ViewCount);

    public static AdminPostListItemDto ToAdminListItem(this PostRow r) => new(
        r.Id,
        r.Title,
        r.Slug,
        r.Status,
        r.Cover.ToCover(),
        r.CategoryName is null ? null : new TermRef(r.CategoryName, r.CategorySlug!),
        r.Tags,
        r.SeriesTitle is null ? null : new SeriesRef(r.SeriesTitle, r.SeriesSlug!, r.SeriesOrder),
        r.IsPinned,
        r.HasWorkingCopy,
        r.WordCount,
        r.ViewCount,
        r.CreatedAt,
        r.UpdatedAt,
        r.PublishedAt,
        r.DeletedAt,
        r.PurgeAt);
}
