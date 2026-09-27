namespace CashewBlog.Domain.Entities;

/// <summary>
/// A blog article. Status transitions and the working-copy rules live here so that
/// every caller (API, jobs, tests) goes through the same invariants.
/// </summary>
public sealed class Post
{
    public static readonly TimeSpan TrashRetention = TimeSpan.FromDays(30);

    public Guid Id { get; set; } = Guid.CreateVersion7();
    public string Title { get; set; } = "";
    public string Slug { get; set; } = "";

    /// <summary>Manual summary; null means "use <see cref="Excerpt"/>".</summary>
    public string? Description { get; set; }

    /// <summary>Live content. For Published/Private posts this is what readers see.</summary>
    public string ContentMarkdown { get; set; } = "";

    /// <summary>
    /// Autosaved working copy for Published/Private posts. Never shown publicly;
    /// promoted into <see cref="ContentMarkdown"/> by an explicit update.
    /// </summary>
    public string? EditingContentMarkdown { get; private set; }
    public DateTimeOffset? EditingSavedAt { get; private set; }

    // Derived data, recomputed whenever ContentMarkdown/title/tags change.
    public string SearchText { get; set; } = "";
    public string Excerpt { get; set; } = "";
    public int WordCount { get; set; }

    public Guid? CoverMediaId { get; set; }
    public MediaAsset? CoverMedia { get; set; }
    public Guid? CategoryId { get; set; }
    public Category? Category { get; set; }
    public Guid? SeriesId { get; set; }
    public Series? Series { get; set; }
    public int? SeriesOrder { get; set; }
    public List<PostTag> PostTags { get; set; } = [];

    public PostStatus Status { get; private set; } = PostStatus.Draft;
    public bool IsPinned { get; set; }
    public string? SeoTitle { get; set; }
    public string? SeoDescription { get; set; }

    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
    public DateTimeOffset? PublishedAt { get; private set; }
    public DateTimeOffset? DeletedAt { get; private set; }
    public DateTimeOffset? PurgeAt { get; private set; }
    public long ViewCount { get; set; }

    public bool IsDeleted => DeletedAt is not null;
    public bool HasWorkingCopy => EditingContentMarkdown is not null;

    /// <summary>
    /// Publishes the post. <see cref="PublishedAt"/> is only assigned on the very first
    /// publication and is preserved across unpublish/republish cycles.
    /// </summary>
    public void Publish(DateTimeOffset now)
    {
        EnsureNotDeleted();
        PublishedAt ??= now;
        Status = PostStatus.Published;
        UpdatedAt = now;
    }

    public void MakePrivate(DateTimeOffset now)
    {
        EnsureNotDeleted();
        Status = PostStatus.Private;
        UpdatedAt = now;
    }

    /// <summary>
    /// Moves the post back to Draft. Drafts have no separate working copy, so a pending
    /// working copy becomes the draft content. Returns true if the content changed.
    /// </summary>
    public bool MakeDraft(DateTimeOffset now)
    {
        EnsureNotDeleted();
        var changed = false;
        if (EditingContentMarkdown is not null)
        {
            changed = EditingContentMarkdown != ContentMarkdown;
            ContentMarkdown = EditingContentMarkdown;
            ClearWorkingCopy();
        }

        Status = PostStatus.Draft;
        UpdatedAt = now;
        return changed;
    }

    /// <summary>
    /// Autosave. Drafts are written directly (nothing public depends on them);
    /// Published/Private posts only update the working copy so live content is untouched.
    /// Returns true when <see cref="ContentMarkdown"/> changed (derived data must be refreshed).
    /// </summary>
    public bool Autosave(string markdown, DateTimeOffset now)
    {
        EnsureNotDeleted();
        if (Status == PostStatus.Draft)
        {
            ContentMarkdown = markdown;
            ClearWorkingCopy();
            UpdatedAt = now;
            return true;
        }

        EditingContentMarkdown = markdown;
        EditingSavedAt = now;
        return false;
    }

    /// <summary>Explicit save/update: the given content goes live and the working copy is discarded.</summary>
    public void ReplaceContent(string markdown, DateTimeOffset now)
    {
        EnsureNotDeleted();
        ContentMarkdown = markdown;
        ClearWorkingCopy();
        UpdatedAt = now;
    }

    public void SoftDelete(DateTimeOffset now)
    {
        if (IsDeleted)
        {
            return;
        }

        DeletedAt = now;
        PurgeAt = now + TrashRetention;
    }

    public void Restore(DateTimeOffset now)
    {
        DeletedAt = null;
        PurgeAt = null;
        UpdatedAt = now;
    }

    private void ClearWorkingCopy()
    {
        EditingContentMarkdown = null;
        EditingSavedAt = null;
    }

    private void EnsureNotDeleted()
    {
        if (IsDeleted)
        {
            throw new DomainException("Post is in the trash; restore it first.");
        }
    }
}
