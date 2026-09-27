using CashewBlog.Application.Abstractions;
using CashewBlog.Application.Common;
using CashewBlog.Application.Settings;
using CashewBlog.Application.Taxonomy;
using CashewBlog.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace CashewBlog.Application.Posts;

public sealed record PostListQuery(int? Page, int? PageSize, string? Category, string? Tag, string? Series);

/// <summary>SeriesSummaryDto fields + ordered published posts.</summary>
public sealed record SeriesDetailDto(
    string Title, string Slug, string? Description, SeriesStatus Status, int Count,
    TermRef? DefaultCategory, DateTimeOffset? LatestPublishedAt, DateTimeOffset UpdatedAt,
    IReadOnlyList<PostSummaryDto> Posts);

public sealed record SitemapEntry(string Slug, DateTimeOffset UpdatedAt);

public sealed record SitemapDto(
    IReadOnlyList<SitemapEntry> Posts,
    IReadOnlyList<SitemapEntry> Pages,
    IReadOnlyList<string> Categories,
    IReadOnlyList<string> Tags,
    IReadOnlyList<string> Series);

/// <summary>Read models for the public site. Only Published posts are visible unless noted.</summary>
public sealed class PublicPostService(IApplicationDbContext db, SettingsService settings)
{
    private IQueryable<Post> Published => db.Posts.AsNoTracking().Where(p => p.Status == PostStatus.Published);

    private static IQueryable<Post> HomeOrder(IQueryable<Post> q) =>
        q.OrderByDescending(p => p.IsPinned).ThenByDescending(p => p.PublishedAt).ThenByDescending(p => p.Id);

    public async Task<PagedResult<PostSummaryDto>> ListAsync(PostListQuery query, CancellationToken ct)
    {
        var defaultSize = (await settings.GetAsync(ct)).Article.PageSize;
        var (page, pageSize) = Paging.Normalize(query.Page, query.PageSize, defaultSize, 50);
        var posts = Published;

        if (!string.IsNullOrWhiteSpace(query.Category))
        {
            // Effective category: own category, else the series' default category.
            var category = query.Category;
            posts = posts.Where(p => p.Category != null
                ? p.Category.Slug == category
                : p.Series != null && p.Series.DefaultCategory != null && p.Series.DefaultCategory.Slug == category);
        }

        if (!string.IsNullOrWhiteSpace(query.Tag))
        {
            posts = posts.Where(p => p.PostTags.Any(pt => pt.Tag.Slug == query.Tag));
        }

        IQueryable<Post> ordered;
        if (!string.IsNullOrWhiteSpace(query.Series))
        {
            // Within a series the reading order matters more than pinning.
            ordered = posts.Where(p => p.Series != null && p.Series.Slug == query.Series)
                .OrderBy(p => p.SeriesOrder).ThenBy(p => p.PublishedAt);
        }
        else
        {
            ordered = HomeOrder(posts);
        }

        var rows = await ordered.Select(PostProjections.Row).ToPagedAsync(page, pageSize, ct);
        return new PagedResult<PostSummaryDto>(rows.Items.Select(r => r.ToSummary()).ToList(), rows.Page, rows.PageSize, rows.TotalItems);
    }

    /// <summary>All published posts (no content), newest first. The frontend groups by year/month.</summary>
    public async Task<List<PostSummaryDto>> ArchiveAsync(CancellationToken ct) =>
        (await Published.OrderByDescending(p => p.PublishedAt).Select(PostProjections.Row).ToListAsync(ct))
        .Select(r => r.ToSummary()).ToList();

    /// <summary>
    /// Post detail. Draft/Private posts are returned only when <paramref name="isAdmin"/>.
    /// With <paramref name="preview"/> (admin only) the autosaved working copy is returned as content.
    /// </summary>
    public async Task<PostDetailDto?> GetAsync(string slug, bool isAdmin, bool preview, CancellationToken ct)
    {
        var source = db.Posts.AsNoTracking().Where(p => p.Slug == slug);
        if (!isAdmin)
        {
            source = source.Where(p => p.Status == PostStatus.Published);
        }

        var row = await source.Select(PostProjections.Row).FirstOrDefaultAsync(ct);
        if (row is null)
        {
            return null;
        }

        var content = await db.Posts.AsNoTracking().Where(p => p.Id == row.Id)
            .Select(p => new { p.ContentMarkdown, p.EditingContentMarkdown, p.SeoTitle, p.SeoDescription })
            .FirstAsync(ct);
        var summary = row.ToSummary();
        var markdown = isAdmin && preview && content.EditingContentMarkdown is not null
            ? content.EditingContentMarkdown
            : content.ContentMarkdown;

        PostLinkDto? previous = null, next = null;
        if (row.Status == PostStatus.Published && row.PublishedAt is { } at)
        {
            // PublishedAt has microsecond precision; exact ties are not worth a tiebreaker.
            previous = await Published
                .Where(p => p.PublishedAt < at)
                .OrderByDescending(p => p.PublishedAt).ThenByDescending(p => p.Id)
                .Select(p => new PostLinkDto(p.Slug, p.Title))
                .FirstOrDefaultAsync(ct);
            next = await Published
                .Where(p => p.PublishedAt > at)
                .OrderBy(p => p.PublishedAt).ThenBy(p => p.Id)
                .Select(p => new PostLinkDto(p.Slug, p.Title))
                .FirstOrDefaultAsync(ct);
        }

        var relatedCount = (await settings.GetAsync(ct)).Article.Discovery.RelatedCount;
        var related = relatedCount > 0 ? await RelatedAsync(row, relatedCount, ct) : [];

        List<SeriesPostLinkDto> seriesPosts = [];
        if (row.SeriesId is { } seriesId)
        {
            var currentId = row.Id;
            seriesPosts = await db.Posts.AsNoTracking()
                .Where(p => p.SeriesId == seriesId && (p.Status == PostStatus.Published || p.Id == currentId))
                .OrderBy(p => p.SeriesOrder).ThenBy(p => p.PublishedAt)
                .Select(p => new SeriesPostLinkDto(p.Slug, p.Title, p.SeriesOrder))
                .ToListAsync(ct);
        }

        return new PostDetailDto(
            summary.Id, summary.Slug, summary.Title, summary.Description, summary.Cover, summary.Category,
            summary.Tags, summary.Series, summary.IsPinned, summary.PublishedAt, summary.UpdatedAt,
            summary.WordCount, summary.ViewCount,
            markdown,
            string.IsNullOrWhiteSpace(content.SeoTitle) ? summary.Title : content.SeoTitle,
            string.IsNullOrWhiteSpace(content.SeoDescription) ? summary.Description : content.SeoDescription,
            row.Status,
            previous,
            next,
            related,
            seriesPosts);
    }

    /// <summary>Published posts sharing tags (2 points each) or the category (1 point).</summary>
    private async Task<List<PostSummaryDto>> RelatedAsync(PostRow row, int count, CancellationToken ct)
    {
        var tagIds = row.Tags.Select(t => t.Id).ToList();
        var categoryId = row.EffectiveCategoryId;
        if (tagIds.Count == 0 && categoryId is null)
        {
            return [];
        }

        var id = row.Id;
        var ranked = await Published
            .Select(p => new
            {
                p.Id,
                p.PublishedAt,
                CategoryId = p.CategoryId != null ? p.CategoryId : (p.Series != null ? p.Series.DefaultCategoryId : null),
                SharedTags = p.PostTags.Count(pt => tagIds.Contains(pt.TagId)),
            })
            .Where(x => x.Id != id && ((categoryId != null && x.CategoryId == categoryId) || x.SharedTags > 0))
            .Select(x => new
            {
                x.Id,
                x.PublishedAt,
                Score = x.SharedTags * 2 + (categoryId != null && x.CategoryId == categoryId ? 1 : 0),
            })
            .OrderByDescending(x => x.Score).ThenByDescending(x => x.PublishedAt)
            .Take(count)
            .Select(x => x.Id)
            .ToListAsync(ct);

        var rows = await Published.Where(p => ranked.Contains(p.Id)).Select(PostProjections.Row).ToListAsync(ct);
        return ranked.Select(rid => rows.First(r => r.Id == rid).ToSummary()).ToList();
    }

    public async Task<SeriesDetailDto> GetSeriesAsync(string slug, CancellationToken ct)
    {
        var series = await db.Series.AsNoTracking().Include(s => s.DefaultCategory).FirstOrDefaultAsync(s => s.Slug == slug, ct)
            ?? throw new NotFoundException("Series not found.");
        var rows = await Published.Where(p => p.SeriesId == series.Id)
            .OrderBy(p => p.SeriesOrder).ThenBy(p => p.PublishedAt)
            .Select(PostProjections.Row)
            .ToListAsync(ct);
        return new SeriesDetailDto(
            series.Title, series.Slug, series.Description, series.Status, rows.Count,
            series.DefaultCategory is null ? null : new TermRef(series.DefaultCategory.Name, series.DefaultCategory.Slug),
            rows.Max(r => r.PublishedAt),
            series.UpdatedAt,
            rows.Select(r => r.ToSummary()).ToList());
    }

    /// <summary>Newest published posts with content, for RSS.</summary>
    public async Task<List<FeedItemDto>> FeedAsync(int? limit, CancellationToken ct)
    {
        var take = limit is null or < 1 ? 20 : Math.Min(limit.Value, 100);
        var rows = await Published.OrderByDescending(p => p.PublishedAt).Take(take).Select(PostProjections.Row).ToListAsync(ct);
        var ids = rows.Select(r => r.Id).ToList();
        var contents = await db.Posts.AsNoTracking().Where(p => ids.Contains(p.Id))
            .Select(p => new { p.Id, p.ContentMarkdown })
            .ToDictionaryAsync(p => p.Id, p => p.ContentMarkdown, ct);

        return rows.Select(r =>
        {
            var s = r.ToSummary();
            return new FeedItemDto(s.Id, s.Slug, s.Title, s.Description, s.Cover, s.Category, s.Tags, s.Series, s.IsPinned,
                s.PublishedAt, s.UpdatedAt, s.WordCount, s.ViewCount, contents[r.Id]);
        }).ToList();
    }

    public async Task<SitemapDto> SitemapAsync(TaxonomyService taxonomy, CancellationToken ct)
    {
        var posts = await Published.OrderByDescending(p => p.PublishedAt)
            .Select(p => new SitemapEntry(p.Slug, p.UpdatedAt)).ToListAsync(ct);
        var pages = await db.CustomPages.AsNoTracking().OrderBy(p => p.Slug)
            .Select(p => new SitemapEntry(p.Slug, p.UpdatedAt)).ToListAsync(ct);
        var categories = (await taxonomy.PublicCategoriesAsync(ct)).Select(c => c.Slug).ToList();
        var tags = (await taxonomy.PublicTagsAsync(ct)).Select(t => t.Slug).ToList();
        var series = (await taxonomy.PublicSeriesAsync(ct)).Where(s => s.Count > 0).Select(s => s.Slug).ToList();
        return new SitemapDto(posts, pages, categories, tags, series);
    }
}
