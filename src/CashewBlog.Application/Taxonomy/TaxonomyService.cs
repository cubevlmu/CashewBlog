using CashewBlog.Application.Abstractions;
using CashewBlog.Application.Common;
using CashewBlog.Application.Posts;
using CashewBlog.Domain.Entities;
using CashewBlog.Domain.Rules;
using Microsoft.EntityFrameworkCore;

namespace CashewBlog.Application.Taxonomy;

/// <summary>Categories, tags and series: public summaries and admin CRUD.</summary>
public sealed class TaxonomyService(IApplicationDbContext db, IClock clock, IPublicCache cache)
{
    private const PostStatus Published = PostStatus.Published;

    // ================================================================ public summaries

    /// <summary>
    /// Categories with at least one published post. Counts use the effective category
    /// (own category, else the series' default category).
    /// </summary>
    public async Task<List<CategorySummaryDto>> PublicCategoriesAsync(CancellationToken ct) =>
        (await db.Categories
            .Select(c => new CategorySummaryDto(c.Name, c.Slug, c.Description,
                db.Posts.Count(p => p.Status == Published
                    && (p.CategoryId == c.Id || (p.CategoryId == null && p.Series != null && p.Series.DefaultCategoryId == c.Id)))))
            .ToListAsync(ct))
        .Where(c => c.Count > 0).OrderBy(c => c.Name).ToList();

    public async Task<List<TagSummaryDto>> PublicTagsAsync(CancellationToken ct) =>
        (await db.Tags
            .Select(t => new TagSummaryDto(t.Name, t.Slug,
                db.Posts.Count(p => p.Status == Published && p.PostTags.Any(pt => pt.TagId == t.Id))))
            .ToListAsync(ct))
        .Where(t => t.Count > 0).OrderByDescending(t => t.Count).ThenBy(t => t.Name).ToList();

    /// <summary>All series, most recently published first (series without published posts last).</summary>
    public async Task<List<SeriesSummaryDto>> PublicSeriesAsync(CancellationToken ct) =>
        (await db.Series
            .Select(s => new SeriesSummaryDto(s.Title, s.Slug, s.Description, s.Status,
                db.Posts.Count(p => p.SeriesId == s.Id && p.Status == Published),
                s.DefaultCategory == null ? null : new TermRef(s.DefaultCategory.Name, s.DefaultCategory.Slug),
                db.Posts.Where(p => p.SeriesId == s.Id && p.Status == Published).Max(p => p.PublishedAt),
                s.UpdatedAt))
            .ToListAsync(ct))
        .OrderByDescending(s => s.LatestPublishedAt.HasValue).ThenByDescending(s => s.LatestPublishedAt).ThenBy(s => s.Title)
        .ToList();

    public async Task<CategorySummaryDto> PublicCategoryAsync(string slug, CancellationToken ct) =>
        await db.Categories.Where(c => c.Slug == slug)
            .Select(c => new CategorySummaryDto(c.Name, c.Slug, c.Description,
                db.Posts.Count(p => p.Status == Published
                    && (p.CategoryId == c.Id || (p.CategoryId == null && p.Series != null && p.Series.DefaultCategoryId == c.Id)))))
            .FirstOrDefaultAsync(ct)
        ?? throw new NotFoundException("Category not found.");

    public async Task<TagSummaryDto> PublicTagAsync(string slug, CancellationToken ct) =>
        await db.Tags.Where(t => t.Slug == slug)
            .Select(t => new TagSummaryDto(t.Name, t.Slug,
                db.Posts.Count(p => p.Status == Published && p.PostTags.Any(pt => pt.TagId == t.Id))))
            .FirstOrDefaultAsync(ct)
        ?? throw new NotFoundException("Tag not found.");

    // ====================================================================== categories

    public Task<List<AdminCategoryDto>> ListCategoriesAsync(CancellationToken ct) =>
        CategoryDtos(db.Categories.OrderBy(c => c.Name)).ToListAsync(ct);

    public async Task<AdminCategoryDto> CreateCategoryAsync(UpsertCategoryRequest request, CancellationToken ct)
    {
        var now = clock.UtcNow;
        var category = new Category { CreatedAt = now };
        await ApplyCategoryAsync(category, request, ct);
        db.Categories.Add(category);
        await SaveAsync(ct);
        return await CategoryDtos(db.Categories.Where(c => c.Id == category.Id)).FirstAsync(ct);
    }

    public async Task<AdminCategoryDto> UpdateCategoryAsync(Guid id, UpsertCategoryRequest request, CancellationToken ct)
    {
        var category = await db.Categories.FirstOrDefaultAsync(c => c.Id == id, ct) ?? throw new NotFoundException("Category not found.");
        await ApplyCategoryAsync(category, request, ct);
        await SaveAsync(ct);
        return await CategoryDtos(db.Categories.Where(c => c.Id == id)).FirstAsync(ct);
    }

    /// <summary>Posts in the category become uncategorized (FK ON DELETE SET NULL, also applied explicitly).</summary>
    public async Task DeleteCategoryAsync(Guid id, CancellationToken ct)
    {
        var category = await db.Categories.FirstOrDefaultAsync(c => c.Id == id, ct) ?? throw new NotFoundException("Category not found.");
        await db.Posts.IgnoreQueryFilters().Where(p => p.CategoryId == id)
            .ExecuteUpdateAsync(s => s.SetProperty(p => p.CategoryId, (Guid?)null), ct);
        await db.Series.Where(s => s.DefaultCategoryId == id)
            .ExecuteUpdateAsync(s => s.SetProperty(x => x.DefaultCategoryId, (Guid?)null), ct);
        db.Categories.Remove(category);
        await SaveAsync(ct);
    }

    private async Task ApplyCategoryAsync(Category category, UpsertCategoryRequest request, CancellationToken ct)
    {
        var errors = new ValidationErrors();
        var name = request.Name?.Trim() ?? "";
        errors.Require(name.Length is > 0 and <= 100, "name", "Name is required (max 100 characters).");
        if (name.Length > 0 && await db.Categories.AnyAsync(c => c.Id != category.Id && c.Name.ToLower() == name.ToLower(), ct))
        {
            errors.Add("name", "A category with this name already exists.");
        }

        var slug = await ResolveSlugAsync(request.Slug, name, category.Slug, "category",
            db.Categories.Where(c => c.Id != category.Id).Select(c => c.Slug), errors, ct);
        errors.ThrowIfAny();

        category.Name = name;
        category.Slug = slug;
        category.Description = string.IsNullOrWhiteSpace(request.Description) ? null : request.Description.Trim();
        category.UpdatedAt = clock.UtcNow;
    }

    private IQueryable<AdminCategoryDto> CategoryDtos(IQueryable<Category> source) =>
        source.Select(c => new AdminCategoryDto(
            c.Id, c.Name, c.Slug, c.Description,
            db.Posts.Count(p => p.CategoryId == c.Id),
            db.Posts.Count(p => p.CategoryId == c.Id && p.Status == Published),
            c.CreatedAt, c.UpdatedAt));

    // ============================================================================ tags

    public Task<List<AdminTagDto>> ListTagsAsync(CancellationToken ct) =>
        TagDtos(db.Tags.OrderBy(t => t.Name)).ToListAsync(ct);

    public async Task<AdminTagDto> CreateTagAsync(UpsertTagRequest request, CancellationToken ct)
    {
        var now = clock.UtcNow;
        var tag = new Tag { CreatedAt = now };
        await ApplyTagAsync(tag, request, ct);
        db.Tags.Add(tag);
        await SaveAsync(ct);
        return await TagDtos(db.Tags.Where(t => t.Id == tag.Id)).FirstAsync(ct);
    }

    public async Task<AdminTagDto> UpdateTagAsync(Guid id, UpsertTagRequest request, CancellationToken ct)
    {
        var tag = await db.Tags.FirstOrDefaultAsync(t => t.Id == id, ct) ?? throw new NotFoundException("Tag not found.");
        var renamed = !string.Equals(tag.Name, request.Name?.Trim(), StringComparison.Ordinal);
        await ApplyTagAsync(tag, request, ct);
        if (renamed)
        {
            // Tag names are part of SearchText.
            await RefreshSearchHeadersAsync(id, removeTag: false, ct);
        }

        await SaveAsync(ct);
        return await TagDtos(db.Tags.Where(t => t.Id == id)).FirstAsync(ct);
    }

    /// <summary>Removes the tag from all posts (association rows only), then deletes it.</summary>
    public async Task DeleteTagAsync(Guid id, CancellationToken ct)
    {
        var tag = await db.Tags.FirstOrDefaultAsync(t => t.Id == id, ct) ?? throw new NotFoundException("Tag not found.");
        await RefreshSearchHeadersAsync(id, removeTag: true, ct);
        db.Tags.Remove(tag);
        await SaveAsync(ct);
    }

    private async Task RefreshSearchHeadersAsync(Guid tagId, bool removeTag, CancellationToken ct)
    {
        var posts = await db.Posts.IgnoreQueryFilters()
            .Where(p => p.PostTags.Any(pt => pt.TagId == tagId))
            .Include(p => p.PostTags).ThenInclude(pt => pt.Tag)
            .ToListAsync(ct);
        foreach (var post in posts)
        {
            if (removeTag)
            {
                post.PostTags.RemoveAll(pt => pt.TagId == tagId);
            }

            PostContentProcessor.RefreshHeader(post, post.PostTags.Select(pt => pt.Tag.Name));
        }
    }

    private async Task ApplyTagAsync(Tag tag, UpsertTagRequest request, CancellationToken ct)
    {
        var errors = new ValidationErrors();
        var name = request.Name?.Trim() ?? "";
        errors.Require(name.Length is > 0 and <= 50, "name", "Name is required (max 50 characters).");
        if (name.Length > 0 && await db.Tags.AnyAsync(t => t.Id != tag.Id && t.Name.ToLower() == name.ToLower(), ct))
        {
            errors.Add("name", "A tag with this name already exists.");
        }

        var slug = await ResolveSlugAsync(request.Slug, name, tag.Slug, "tag",
            db.Tags.Where(t => t.Id != tag.Id).Select(t => t.Slug), errors, ct);
        errors.ThrowIfAny();

        tag.Name = name;
        tag.Slug = slug;
        tag.UpdatedAt = clock.UtcNow;
    }

    private IQueryable<AdminTagDto> TagDtos(IQueryable<Tag> source) =>
        source.Select(t => new AdminTagDto(
            t.Id, t.Name, t.Slug,
            db.Posts.Count(p => p.PostTags.Any(pt => pt.TagId == t.Id)),
            db.Posts.Count(p => p.Status == Published && p.PostTags.Any(pt => pt.TagId == t.Id)),
            t.CreatedAt, t.UpdatedAt));

    // ========================================================================== series

    public Task<List<AdminSeriesDto>> ListSeriesAsync(CancellationToken ct) =>
        SeriesDtos(db.Series.OrderBy(s => s.Title)).ToListAsync(ct);

    public async Task<AdminSeriesDetailDto> GetSeriesAsync(Guid id, CancellationToken ct)
    {
        var series = await SeriesDtos(db.Series.Where(s => s.Id == id)).FirstOrDefaultAsync(ct)
            ?? throw new NotFoundException("Series not found.");
        var posts = await db.Posts.Where(p => p.SeriesId == id)
            .OrderBy(p => p.SeriesOrder).ThenBy(p => p.CreatedAt)
            .Select(p => new AdminSeriesPostDto(p.Id, p.Title, p.Slug, p.Status, p.SeriesOrder, p.PublishedAt))
            .ToListAsync(ct);
        return new AdminSeriesDetailDto(series, posts);
    }

    public async Task<AdminSeriesDetailDto> CreateSeriesAsync(UpsertSeriesRequest request, CancellationToken ct)
    {
        var series = new Series { CreatedAt = clock.UtcNow };
        await ApplySeriesAsync(series, request, ct);
        db.Series.Add(series);
        await SaveAsync(ct);
        return await GetSeriesAsync(series.Id, ct);
    }

    public async Task<AdminSeriesDetailDto> UpdateSeriesAsync(Guid id, UpsertSeriesRequest request, CancellationToken ct)
    {
        var series = await db.Series.FirstOrDefaultAsync(s => s.Id == id, ct) ?? throw new NotFoundException("Series not found.");
        await ApplySeriesAsync(series, request, ct);
        await SaveAsync(ct);
        return await GetSeriesAsync(id, ct);
    }

    /// <summary>Posts stay intact; their series reference and order are cleared.</summary>
    public async Task DeleteSeriesAsync(Guid id, CancellationToken ct)
    {
        var series = await db.Series.FirstOrDefaultAsync(s => s.Id == id, ct) ?? throw new NotFoundException("Series not found.");
        await db.Posts.IgnoreQueryFilters().Where(p => p.SeriesId == id)
            .ExecuteUpdateAsync(s => s.SetProperty(p => p.SeriesId, (Guid?)null).SetProperty(p => p.SeriesOrder, (int?)null), ct);
        db.Series.Remove(series);
        await SaveAsync(ct);
    }

    /// <summary>Sets SeriesOrder = 1..N following <see cref="ReorderSeriesRequest.PostIds"/>.</summary>
    public async Task<AdminSeriesDetailDto> ReorderSeriesAsync(Guid id, ReorderSeriesRequest request, CancellationToken ct)
    {
        if (!await db.Series.AnyAsync(s => s.Id == id, ct))
        {
            throw new NotFoundException("Series not found.");
        }

        var ids = request.PostIds ?? [];
        var posts = await db.Posts.Where(p => p.SeriesId == id).ToListAsync(ct);
        if (ids.Count != ids.Distinct().Count() || ids.Any(pid => posts.All(p => p.Id != pid)))
        {
            throw new ValidationException("postIds", "Post ids must be distinct posts of this series.");
        }

        var order = 1;
        foreach (var pid in ids)
        {
            posts.First(p => p.Id == pid).SeriesOrder = order++;
        }

        // Posts not mentioned keep their relative order after the listed ones.
        foreach (var post in posts.Where(p => !ids.Contains(p.Id)).OrderBy(p => p.SeriesOrder))
        {
            post.SeriesOrder = order++;
        }

        await SaveAsync(ct);
        return await GetSeriesAsync(id, ct);
    }

    private async Task ApplySeriesAsync(Series series, UpsertSeriesRequest request, CancellationToken ct)
    {
        var errors = new ValidationErrors();
        var title = request.Title?.Trim() ?? "";
        errors.Require(title.Length is > 0 and <= 200, "title", "Title is required (max 200 characters).");
        if (request.DefaultCategoryId is { } categoryId && !await db.Categories.AnyAsync(c => c.Id == categoryId, ct))
        {
            errors.Add("defaultCategoryId", "Category does not exist.");
        }

        var slug = await ResolveSlugAsync(request.Slug, title, series.Slug, "series",
            db.Series.Where(s => s.Id != series.Id).Select(s => s.Slug), errors, ct);
        errors.ThrowIfAny();

        series.Title = title;
        series.Slug = slug;
        series.Description = string.IsNullOrWhiteSpace(request.Description) ? null : request.Description.Trim();
        series.Status = request.Status ?? SeriesStatus.Ongoing;
        series.DefaultCategoryId = request.DefaultCategoryId;
        series.UpdatedAt = clock.UtcNow;
    }

    private IQueryable<AdminSeriesDto> SeriesDtos(IQueryable<Series> source) =>
        source.Select(s => new AdminSeriesDto(
            s.Id, s.Title, s.Slug, s.Description, s.Status, s.DefaultCategoryId,
            db.Posts.Count(p => p.SeriesId == s.Id),
            db.Posts.Count(p => p.SeriesId == s.Id && p.Status == Published),
            s.CreatedAt, s.UpdatedAt));

    // ========================================================================= helpers

    /// <summary>
    /// Explicit slug: normalized and must be free (validation error otherwise).
    /// No slug: keep the current one, or derive a unique slug from the name.
    /// </summary>
    private static async Task<string> ResolveSlugAsync(
        string? requested, string name, string current, string fallback,
        IQueryable<string> otherSlugs, ValidationErrors errors, CancellationToken ct)
    {
        if (!string.IsNullOrWhiteSpace(requested))
        {
            var normalized = SlugGenerator.Normalize(requested);
            if (normalized.Length == 0)
            {
                errors.Add("slug", "Slug must contain letters or digits.");
                return current;
            }

            if (normalized != current && await otherSlugs.AnyAsync(s => s == normalized, ct))
            {
                errors.Add("slug", "This slug is already in use.");
            }

            return normalized;
        }

        if (!string.IsNullOrEmpty(current))
        {
            return current;
        }

        var taken = (await otherSlugs.ToListAsync(ct)).ToHashSet(StringComparer.Ordinal);
        return SlugGenerator.MakeUnique(SlugGenerator.FromTitle(null, name, fallback), taken);
    }

    private async Task SaveAsync(CancellationToken ct)
    {
        await db.SaveChangesAsync(ct);
        cache.Invalidate();
    }
}
