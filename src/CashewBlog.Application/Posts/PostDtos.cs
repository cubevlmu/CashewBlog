using CashewBlog.Domain.Entities;

namespace CashewBlog.Application.Posts;

public sealed record TermRef(string Name, string Slug);

public sealed record SeriesRef(string Title, string Slug, int? Order);

public sealed record CoverDto(string Url, string? ThumbUrl, int? Width, int? Height, string? Alt);

public sealed record PostLinkDto(string Slug, string Title);

public sealed record SeriesPostLinkDto(string Slug, string Title, int? Order);

public sealed record PostSummaryDto(
    Guid Id,
    string Slug,
    string Title,
    string Description,
    CoverDto? Cover,
    TermRef? Category,
    IReadOnlyList<TermRef> Tags,
    SeriesRef? Series,
    bool IsPinned,
    DateTimeOffset? PublishedAt,
    DateTimeOffset UpdatedAt,
    int WordCount,
    long ViewCount);

public sealed record PostDetailDto(
    Guid Id,
    string Slug,
    string Title,
    string Description,
    CoverDto? Cover,
    TermRef? Category,
    IReadOnlyList<TermRef> Tags,
    SeriesRef? Series,
    bool IsPinned,
    DateTimeOffset? PublishedAt,
    DateTimeOffset UpdatedAt,
    int WordCount,
    long ViewCount,
    string ContentMarkdown,
    string SeoTitle,
    string SeoDescription,
    PostStatus Status,
    PostLinkDto? Previous,
    PostLinkDto? Next,
    IReadOnlyList<PostSummaryDto> Related,
    IReadOnlyList<SeriesPostLinkDto> SeriesPosts);

/// <summary>PostSummaryDto fields + contentMarkdown (for RSS).</summary>
public sealed record FeedItemDto(
    Guid Id,
    string Slug,
    string Title,
    string Description,
    CoverDto? Cover,
    TermRef? Category,
    IReadOnlyList<TermRef> Tags,
    SeriesRef? Series,
    bool IsPinned,
    DateTimeOffset? PublishedAt,
    DateTimeOffset UpdatedAt,
    int WordCount,
    long ViewCount,
    string ContentMarkdown);

// ------------------------------------------------------------------------------ admin

public sealed record AdminTagRef(Guid Id, string Name, string Slug);

public sealed record AdminPostDto(
    Guid Id,
    string Title,
    string Slug,
    string? Description,
    string Excerpt,
    string ContentMarkdown,
    string? EditingContentMarkdown,
    DateTimeOffset? EditingSavedAt,
    bool HasWorkingCopy,
    Guid? CoverMediaId,
    CoverDto? Cover,
    Guid? CategoryId,
    TermRef? Category,
    Guid? SeriesId,
    SeriesRef? Series,
    int? SeriesOrder,
    IReadOnlyList<AdminTagRef> Tags,
    PostStatus Status,
    bool IsPinned,
    string? SeoTitle,
    string? SeoDescription,
    int WordCount,
    long ViewCount,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt,
    DateTimeOffset? PublishedAt,
    DateTimeOffset? DeletedAt,
    DateTimeOffset? PurgeAt);

public sealed record AdminPostListItemDto(
    Guid Id,
    string Title,
    string Slug,
    PostStatus Status,
    CoverDto? Cover,
    TermRef? Category,
    IReadOnlyList<AdminTagRef> Tags,
    SeriesRef? Series,
    bool IsPinned,
    bool HasWorkingCopy,
    int WordCount,
    long ViewCount,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt,
    DateTimeOffset? PublishedAt,
    DateTimeOffset? DeletedAt,
    DateTimeOffset? PurgeAt);

public sealed record AdminPostQuery(
    string? Q,
    PostStatus? Status,
    Guid? CategoryId,
    Guid? TagId,
    Guid? SeriesId,
    bool Trash,
    string? Sort,
    string? Order,
    int? Page,
    int? PageSize);

/// <summary>Create/update payload. Omitted optional fields are treated as null/empty.</summary>
public sealed record UpsertPostRequest(
    string? Title,
    string? Slug,
    string? Description,
    string? ContentMarkdown,
    Guid? CoverMediaId,
    Guid? CategoryId,
    Guid? SeriesId,
    int? SeriesOrder,
    IReadOnlyList<string>? Tags,
    bool IsPinned,
    string? SeoTitle,
    string? SeoDescription);

public sealed record AutosavePostRequest(string? ContentMarkdown, string? Title);

public sealed record AutosaveResult(PostStatus Status, bool HasWorkingCopy, DateTimeOffset SavedAt, DateTimeOffset UpdatedAt);

public sealed record BulkDeleteRequest(IReadOnlyList<Guid>? Ids);

public sealed record BulkDeleteResult(int Deleted);
