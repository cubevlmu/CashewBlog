using CashewBlog.Domain;
using CashewBlog.Domain.Entities;

namespace CashewBlog.UnitTests;

public class PostRulesTests
{
    private static readonly DateTimeOffset T0 = new(2026, 1, 1, 8, 0, 0, TimeSpan.Zero);

    [Fact]
    public void First_publish_sets_PublishedAt()
    {
        var post = new Post();
        Assert.Null(post.PublishedAt);

        post.Publish(T0);

        Assert.Equal(PostStatus.Published, post.Status);
        Assert.Equal(T0, post.PublishedAt);
    }

    [Fact]
    public void Republish_after_draft_preserves_original_PublishedAt()
    {
        var post = new Post();
        post.Publish(T0);
        post.MakeDraft(T0.AddDays(1));
        post.Publish(T0.AddDays(2));

        Assert.Equal(T0, post.PublishedAt);
        Assert.Equal(T0.AddDays(2), post.UpdatedAt);
    }

    [Fact]
    public void Private_does_not_set_PublishedAt()
    {
        var post = new Post();
        post.MakePrivate(T0);

        Assert.Equal(PostStatus.Private, post.Status);
        Assert.Null(post.PublishedAt);
    }

    [Fact]
    public void Autosave_on_draft_writes_content_directly()
    {
        var post = new Post { ContentMarkdown = "old" };

        var changed = post.Autosave("new", T0);

        Assert.True(changed);
        Assert.Equal("new", post.ContentMarkdown);
        Assert.False(post.HasWorkingCopy);
    }

    [Theory]
    [InlineData(PostStatus.Published)]
    [InlineData(PostStatus.Private)]
    public void Autosave_on_live_post_only_touches_working_copy(PostStatus status)
    {
        var post = new Post { ContentMarkdown = "live" };
        if (status == PostStatus.Published)
        {
            post.Publish(T0);
        }
        else
        {
            post.MakePrivate(T0);
        }

        var changed = post.Autosave("editing", T0.AddMinutes(5));

        Assert.False(changed);
        Assert.Equal("live", post.ContentMarkdown);
        Assert.Equal("editing", post.EditingContentMarkdown);
        Assert.Equal(T0.AddMinutes(5), post.EditingSavedAt);
        Assert.Equal(T0, post.UpdatedAt); // public "updated" timestamp untouched
    }

    [Fact]
    public void Explicit_update_promotes_content_and_clears_working_copy()
    {
        var post = new Post { ContentMarkdown = "live" };
        post.Publish(T0);
        post.Autosave("editing", T0.AddMinutes(1));

        post.ReplaceContent("editing", T0.AddMinutes(2));

        Assert.Equal("editing", post.ContentMarkdown);
        Assert.False(post.HasWorkingCopy);
        Assert.Null(post.EditingSavedAt);
    }

    [Fact]
    public void Moving_to_draft_merges_the_working_copy()
    {
        var post = new Post { ContentMarkdown = "live" };
        post.Publish(T0);
        post.Autosave("editing", T0.AddMinutes(1));

        var changed = post.MakeDraft(T0.AddMinutes(2));

        Assert.True(changed);
        Assert.Equal("editing", post.ContentMarkdown);
        Assert.False(post.HasWorkingCopy);
    }

    [Fact]
    public void Soft_delete_sets_purge_date_and_restore_clears_it()
    {
        var post = new Post();
        post.SoftDelete(T0);

        Assert.Equal(T0, post.DeletedAt);
        Assert.Equal(T0.AddDays(30), post.PurgeAt);

        post.Restore(T0.AddDays(1));
        Assert.Null(post.DeletedAt);
        Assert.Null(post.PurgeAt);
    }

    [Fact]
    public void Trashed_post_cannot_change_status()
    {
        var post = new Post();
        post.SoftDelete(T0);

        Assert.Throws<DomainException>(() => post.Publish(T0));
        Assert.Throws<DomainException>(() => post.Autosave("x", T0));
    }
}
