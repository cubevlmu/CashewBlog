using CashewBlog.Application.Posts;
using CashewBlog.Domain.Entities;

namespace CashewBlog.Application.Taxonomy;

// Public (counts = published posts only)
public sealed record CategorySummaryDto(string Name, string Slug, string? Description, int Count);

public sealed record TagSummaryDto(string Name, string Slug, int Count);

public sealed record SeriesSummaryDto(
    string Title, string Slug, string? Description, SeriesStatus Status, int Count,
    TermRef? DefaultCategory, DateTimeOffset? LatestPublishedAt, DateTimeOffset UpdatedAt);

// Admin (postCount = all non-trashed posts, publishedCount = published only)
public sealed record AdminCategoryDto(
    Guid Id, string Name, string Slug, string? Description, int PostCount, int PublishedCount,
    DateTimeOffset CreatedAt, DateTimeOffset UpdatedAt);

public sealed record AdminTagDto(
    Guid Id, string Name, string Slug, int PostCount, int PublishedCount,
    DateTimeOffset CreatedAt, DateTimeOffset UpdatedAt);

public sealed record AdminSeriesDto(
    Guid Id, string Title, string Slug, string? Description, SeriesStatus Status, Guid? DefaultCategoryId,
    int PostCount, int PublishedCount, DateTimeOffset CreatedAt, DateTimeOffset UpdatedAt);

public sealed record AdminSeriesPostDto(Guid Id, string Title, string Slug, PostStatus Status, int? SeriesOrder, DateTimeOffset? PublishedAt);

public sealed record AdminSeriesDetailDto(AdminSeriesDto Series, IReadOnlyList<AdminSeriesPostDto> Posts);

public sealed record UpsertCategoryRequest(string? Name, string? Slug, string? Description);

public sealed record UpsertTagRequest(string? Name, string? Slug);

public sealed record UpsertSeriesRequest(string? Title, string? Slug, string? Description, SeriesStatus? Status, Guid? DefaultCategoryId);

public sealed record ReorderSeriesRequest(IReadOnlyList<Guid>? PostIds);
