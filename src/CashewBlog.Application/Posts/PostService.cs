using CashewBlog.Application.Abstractions;
using CashewBlog.Application.Common;
using CashewBlog.Application.Media;
using CashewBlog.Application.Taxonomy;
using CashewBlog.Domain;
using CashewBlog.Domain.Entities;
using CashewBlog.Domain.Rules;
using Microsoft.EntityFrameworkCore;

namespace CashewBlog.Application.Posts;

/// <summary>Admin use cases for posts: CRUD, status transitions, autosave, trash.</summary>
public sealed class PostService(
    IApplicationDbContext db,
    IClock clock,
    PostContentProcessor processor,
    IPublicCache cache)
{
    public async Task<PagedResult<AdminPostListItemDto>> ListAsync(AdminPostQuery query, CancellationToken ct)
    {
        var (page, pageSize) = Paging.Normalize(query.Page, query.PageSize, 20);
        var posts = query.Trash
            ? db.Posts.IgnoreQueryFilters().Where(p => p.DeletedAt != null)
            : db.Posts.AsQueryable();

        if (!string.IsNullOrWhiteSpace(query.Q))
        {
            var q = query.Q.Trim().ToLower();
            posts = posts.Where(p => p.Title.ToLower().Contains(q) || p.Slug.ToLower().Contains(q));
        }

        if (query.Status is { } status)
        {
            posts = posts.Where(p => p.Status == status);
        }

        if (query.CategoryId is { } categoryId)
        {
            posts = posts.Where(p => p.CategoryId == categoryId);
        }

        if (query.TagId is { } tagId)
        {
            posts = posts.Where(p => p.PostTags.Any(pt => pt.TagId == tagId));
        }

        if (query.SeriesId is { } seriesId)
        {
            posts = posts.Where(p => p.SeriesId == seriesId);
        }

        var asc = string.Equals(query.Order, "asc", StringComparison.OrdinalIgnoreCase);
        posts = (query.Sort?.ToLowerInvariant()) switch
        {
            "title" => asc ? posts.OrderBy(p => p.Title) : posts.OrderByDescending(p => p.Title),
            "createdat" => asc ? posts.OrderBy(p => p.CreatedAt) : posts.OrderByDescending(p => p.CreatedAt),
            "publishedat" => asc ? posts.OrderBy(p => p.PublishedAt) : posts.OrderByDescending(p => p.PublishedAt),
            "viewcount" => asc ? posts.OrderBy(p => p.ViewCount) : posts.OrderByDescending(p => p.ViewCount),
            "deletedat" => asc ? posts.OrderBy(p => p.DeletedAt) : posts.OrderByDescending(p => p.DeletedAt),
            _ => asc ? posts.OrderBy(p => p.UpdatedAt) : posts.OrderByDescending(p => p.UpdatedAt),
        };

        var rows = await posts.Select(PostProjections.Row).ToPagedAsync(page, pageSize, ct);
        return new PagedResult<AdminPostListItemDto>(
            rows.Items.Select(r => r.ToAdminListItem()).ToList(), rows.Page, rows.PageSize, rows.TotalItems);
    }

    public async Task<AdminPostDto> GetAsync(Guid id, CancellationToken ct)
    {
        var post = await LoadAsync(id, includeDeleted: true, ct, tracking: false);
        return ToDto(post);
    }

    public async Task<AdminPostDto> CreateAsync(UpsertPostRequest request, CancellationToken ct)
    {
        var now = clock.UtcNow;
        var post = new Post { CreatedAt = now, UpdatedAt = now };
        db.Posts.Add(post);
        await ApplyAsync(post, request, ct);
        await SaveAsync(post, ct);
        return await GetAsync(post.Id, ct);
    }

    /// <summary>Explicit save ("Update"): metadata and content go live, the working copy is cleared.</summary>
    public async Task<AdminPostDto> UpdateAsync(Guid id, UpsertPostRequest request, CancellationToken ct)
    {
        var post = await LoadAsync(id, includeDeleted: false, ct);
        await ApplyAsync(post, request, ct);
        await SaveAsync(post, ct);
        return await GetAsync(id, ct);
    }

    public Task<AdminPostDto> PublishAsync(Guid id, UpsertPostRequest? request, CancellationToken ct) =>
        TransitionAsync(id, request, (post, now) => post.Publish(now), ct);

    public Task<AdminPostDto> MakePrivateAsync(Guid id, UpsertPostRequest? request, CancellationToken ct) =>
        TransitionAsync(id, request, (post, now) => post.MakePrivate(now), ct);

    public Task<AdminPostDto> MakeDraftAsync(Guid id, UpsertPostRequest? request, CancellationToken ct) =>
        TransitionAsync(id, request, (post, now) =>
        {
            if (post.MakeDraft(now))
            {
                processor.Refresh(post, post.PostTags.Select(pt => pt.Tag.Name));
            }
        }, ct);

    public async Task<AutosaveResult> AutosaveAsync(Guid id, AutosavePostRequest request, CancellationToken ct)
    {
        if (request.ContentMarkdown is null)
        {
            throw new ValidationException("contentMarkdown", "Content is required.");
        }

        var post = await LoadAsync(id, includeDeleted: false, ct);
        var now = clock.UtcNow;
        var contentChanged = Run(() => post.Autosave(request.ContentMarkdown, now));

        // Drafts may also autosave the title; for live posts the title is only changed by Update.
        if (post.Status == PostStatus.Draft && !string.IsNullOrWhiteSpace(request.Title))
        {
            post.Title = request.Title.Trim();
            contentChanged = true;
        }

        if (contentChanged)
        {
            processor.Refresh(post, post.PostTags.Select(pt => pt.Tag.Name));
        }

        await RefreshMediaReferencesAsync(post, ct);
        await db.SaveChangesAsync(ct);
        return new AutosaveResult(post.Status, post.HasWorkingCopy, post.EditingSavedAt ?? post.UpdatedAt, post.UpdatedAt);
    }

    public async Task SoftDeleteAsync(Guid id, CancellationToken ct)
    {
        var post = await LoadAsync(id, includeDeleted: false, ct);
        post.SoftDelete(clock.UtcNow);
        await db.SaveChangesAsync(ct);
        cache.Invalidate();
    }

    public async Task<BulkDeleteResult> BulkSoftDeleteAsync(BulkDeleteRequest request, CancellationToken ct)
    {
        var ids = request.Ids?.Distinct().ToList() ?? [];
        if (ids.Count == 0)
        {
            throw new ValidationException("ids", "At least one post id is required.");
        }

        var posts = await db.Posts.Where(p => ids.Contains(p.Id)).ToListAsync(ct);
        var now = clock.UtcNow;
        foreach (var post in posts)
        {
            post.SoftDelete(now);
        }

        await db.SaveChangesAsync(ct);
        cache.Invalidate();
        return new BulkDeleteResult(posts.Count);
    }

    public async Task<AdminPostDto> RestoreAsync(Guid id, CancellationToken ct)
    {
        var post = await LoadAsync(id, includeDeleted: true, ct);
        post.Restore(clock.UtcNow);
        await db.SaveChangesAsync(ct);
        cache.Invalidate();
        return ToDto(post);
    }

    public async Task DeletePermanentlyAsync(Guid id, CancellationToken ct)
    {
        var exists = await db.Posts.IgnoreQueryFilters().AnyAsync(p => p.Id == id, ct);
        if (!exists)
        {
            throw new NotFoundException("Post not found.");
        }

        await PurgeAsync([id], ct);
    }

    /// <summary>Hard-deletes trashed posts whose retention expired. Safe to re-run.</summary>
    public async Task<int> PurgeExpiredAsync(CancellationToken ct)
    {
        var now = clock.UtcNow;
        var ids = await db.Posts.IgnoreQueryFilters()
            .Where(p => p.PurgeAt != null && p.PurgeAt <= now)
            .Select(p => p.Id)
            .ToListAsync(ct);
        if (ids.Count > 0)
        {
            await PurgeAsync(ids, ct);
        }

        return ids.Count;
    }

    private async Task PurgeAsync(List<Guid> ids, CancellationToken ct)
    {
        // MediaReferences has no FK to its owner, so remove those explicitly. PostTags,
        // PostDailyStats and PostViewDedupe cascade in the database.
        await db.MediaReferences
            .Where(r => r.OwnerType == MediaOwnerType.Post && r.OwnerId != null && ids.Contains(r.OwnerId.Value))
            .ExecuteDeleteAsync(ct);
        await db.Posts.IgnoreQueryFilters().Where(p => ids.Contains(p.Id)).ExecuteDeleteAsync(ct);
        cache.Invalidate();
    }

    // ---------------------------------------------------------------------- internals

    private async Task<AdminPostDto> TransitionAsync(Guid id, UpsertPostRequest? request, Action<Post, DateTimeOffset> transition, CancellationToken ct)
    {
        var post = await LoadAsync(id, includeDeleted: false, ct);
        if (request is not null)
        {
            await ApplyAsync(post, request, ct);
        }

        Run(() => transition(post, clock.UtcNow));
        await SaveAsync(post, ct);
        return await GetAsync(id, ct);
    }

    private async Task<Post> LoadAsync(Guid id, bool includeDeleted, CancellationToken ct, bool tracking = true)
    {
        var query = includeDeleted ? db.Posts.IgnoreQueryFilters() : db.Posts;
        if (!tracking)
        {
            query = query.AsNoTracking();
        }

        return await query
            .Include(p => p.PostTags).ThenInclude(pt => pt.Tag)
            .Include(p => p.Category)
            .Include(p => p.Series)
            .Include(p => p.CoverMedia)
            .AsSplitQuery()
            .FirstOrDefaultAsync(p => p.Id == id, ct)
            ?? throw new NotFoundException("Post not found.");
    }

    private async Task ApplyAsync(Post post, UpsertPostRequest request, CancellationToken ct)
    {
        var errors = new ValidationErrors();
        var title = request.Title?.Trim() ?? "";
        errors.Require(title.Length is > 0 and <= 200, "title", "Title is required (max 200 characters).");
        errors.Require(request.ContentMarkdown is not null, "contentMarkdown", "Content is required (may be empty).");
        errors.Require((request.Description?.Length ?? 0) <= 1000, "description", "Max 1000 characters.");
        errors.Require((request.SeoTitle?.Length ?? 0) <= 200, "seoTitle", "Max 200 characters.");
        errors.Require((request.SeoDescription?.Length ?? 0) <= 500, "seoDescription", "Max 500 characters.");
        var tagNames = (request.Tags ?? [])
            .Select(t => t?.Trim() ?? "")
            .Where(t => t.Length > 0)
            .DistinctBy(t => t.ToLowerInvariant())
            .ToList();
        errors.Require(tagNames.Count <= 50 && tagNames.All(t => t.Length <= 50), "tags", "At most 50 tags of up to 50 characters each.");

        if (request.CategoryId is { } categoryId && !await db.Categories.AnyAsync(c => c.Id == categoryId, ct))
        {
            errors.Add("categoryId", "Category does not exist.");
        }

        Series? series = null;
        if (request.SeriesId is { } seriesId)
        {
            series = await db.Series.FirstOrDefaultAsync(s => s.Id == seriesId, ct);
            errors.Require(series is not null, "seriesId", "Series does not exist.");
        }

        if (request.CoverMediaId is { } coverId && !await db.MediaAssets.AnyAsync(m => m.Id == coverId, ct))
        {
            errors.Add("coverMediaId", "Media asset does not exist.");
        }

        // Slug: explicit value wins (normalized); otherwise keep the existing slug, or derive from the title.
        string? newSlug = null;
        if (!string.IsNullOrWhiteSpace(request.Slug))
        {
            var normalized = SlugGenerator.Normalize(request.Slug);
            if (normalized.Length == 0)
            {
                errors.Add("slug", "Slug must contain letters or digits.");
            }
            else if (normalized != post.Slug)
            {
                if (await db.Posts.IgnoreQueryFilters().AnyAsync(p => p.Slug == normalized && p.Id != post.Id, ct))
                {
                    errors.Add("slug", "This slug is already used by another post.");
                }

                newSlug = normalized;
            }
        }
        else if (string.IsNullOrEmpty(post.Slug) && title.Length > 0)
        {
            var baseSlug = SlugGenerator.FromTitle(null, title);
            newSlug = await UniqueSlugAsync(baseSlug, post.Id, ct);
        }

        errors.ThrowIfAny();

        var now = clock.UtcNow;
        post.Title = title;
        if (newSlug is not null)
        {
            post.Slug = newSlug;
        }

        post.Description = NullIfBlank(request.Description);
        post.SeoTitle = NullIfBlank(request.SeoTitle);
        post.SeoDescription = NullIfBlank(request.SeoDescription);
        post.IsPinned = request.IsPinned;
        post.CoverMediaId = request.CoverMediaId;
        // The series' default category is not copied: public views derive the effective category.
        post.CategoryId = request.CategoryId;

        var seriesChanged = post.SeriesId != request.SeriesId;
        post.SeriesId = request.SeriesId;
        if (post.SeriesId is null)
        {
            post.SeriesOrder = null;
        }
        else if (request.SeriesOrder is { } order)
        {
            post.SeriesOrder = order;
        }
        else if (seriesChanged || post.SeriesOrder is null)
        {
            var max = await db.Posts.IgnoreQueryFilters()
                .Where(p => p.SeriesId == post.SeriesId && p.Id != post.Id)
                .MaxAsync(p => p.SeriesOrder, ct);
            post.SeriesOrder = (max ?? 0) + 1;
        }

        var tags = await TagResolver.ResolveAsync(db, tagNames, now, ct);
        post.PostTags.RemoveAll(pt => !tags.Any(t => t.Id == pt.TagId));
        foreach (var tag in tags.Where(t => post.PostTags.All(pt => pt.TagId != t.Id)))
        {
            post.PostTags.Add(new PostTag { Post = post, Tag = tag, TagId = tag.Id });
        }

        Run(() => post.ReplaceContent(request.ContentMarkdown!, now));
        processor.Refresh(post, tags.Select(t => t.Name));
    }

    private async Task<string> UniqueSlugAsync(string baseSlug, Guid postId, CancellationToken ct)
    {
        var prefix = baseSlug + "-";
        var taken = await db.Posts.IgnoreQueryFilters()
            .Where(p => p.Id != postId && (p.Slug == baseSlug || p.Slug.StartsWith(prefix)))
            .Select(p => p.Slug)
            .ToListAsync(ct);
        return SlugGenerator.MakeUnique(baseSlug, taken.ToHashSet(StringComparer.Ordinal));
    }

    private async Task SaveAsync(Post post, CancellationToken ct)
    {
        await RefreshMediaReferencesAsync(post, ct);
        await db.SaveChangesAsync(ct);
        cache.Invalidate();
    }

    private Task RefreshMediaReferencesAsync(Post post, CancellationToken ct) =>
        MediaReferenceTracker.ReplaceAsync(db, MediaOwnerType.Post, post.Id,
        [
            ("cover", post.CoverMediaId, null),
            ("body", null, post.ContentMarkdown),
            ("workingCopy", null, post.EditingContentMarkdown),
        ], ct);

    private static string? NullIfBlank(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    private static T Run<T>(Func<T> action)
    {
        try
        {
            return action();
        }
        catch (DomainException ex)
        {
            throw new ConflictException("invalid_state", ex.Message);
        }
    }

    private static void Run(Action action) => Run(() =>
    {
        action();
        return true;
    });

    private static AdminPostDto ToDto(Post p) => new(
        p.Id,
        p.Title,
        p.Slug,
        p.Description,
        p.Excerpt,
        p.ContentMarkdown,
        p.EditingContentMarkdown,
        p.EditingSavedAt,
        p.HasWorkingCopy,
        p.CoverMediaId,
        p.CoverMedia.ToCover(),
        p.CategoryId,
        p.Category is null ? null : new TermRef(p.Category.Name, p.Category.Slug),
        p.SeriesId,
        p.Series is null ? null : new SeriesRef(p.Series.Title, p.Series.Slug, p.SeriesOrder),
        p.SeriesOrder,
        p.PostTags.Select(pt => new AdminTagRef(pt.Tag.Id, pt.Tag.Name, pt.Tag.Slug)).OrderBy(t => t.Name).ToList(),
        p.Status,
        p.IsPinned,
        p.SeoTitle,
        p.SeoDescription,
        p.WordCount,
        p.ViewCount,
        p.CreatedAt,
        p.UpdatedAt,
        p.PublishedAt,
        p.DeletedAt,
        p.PurgeAt);
}
