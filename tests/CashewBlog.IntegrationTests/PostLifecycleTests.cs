using System.Net;
using System.Text.Json;
using CashewBlog.Application.Common;
using CashewBlog.Application.Posts;
using CashewBlog.Domain.Entities;
using CashewBlog.IntegrationTests.Infrastructure;

namespace CashewBlog.IntegrationTests;

public class PostLifecycleTests(CashewBlogFactory factory) : IClassFixture<CashewBlogFactory>
{
    [Fact]
    public async Task Draft_is_invisible_until_published_and_PublishedAt_is_preserved()
    {
        var admin = await factory.CreateAdminClientAsync();
        var anonymous = factory.CreateBrowserClient();

        var draft = await admin.CreatePostAsync("Lifecycle 生命周期", "Draft **body**");
        Assert.Equal(PostStatus.Draft, draft.Status);
        Assert.Equal("lifecycle-生命周期", draft.Slug);
        Assert.Null(draft.PublishedAt);

        await (await anonymous.GetAsync($"/api/posts/{Uri.EscapeDataString(draft.Slug)}")).AssertStatusAsync(HttpStatusCode.NotFound);
        var list = await anonymous.GetAsync<PagedResult<PostSummaryDto>>("/api/posts");
        Assert.DoesNotContain(list.Items, p => p.Id == draft.Id);

        // Admin cookie on the public endpoint sees the draft, never cached.
        var preview = await admin.GetAsync($"/api/posts/{Uri.EscapeDataString(draft.Slug)}");
        await preview.AssertStatusAsync(HttpStatusCode.OK);
        Assert.True(preview.Headers.CacheControl is { Private: true, NoStore: true });

        var published = await (await admin.PostAsync($"/api/admin/posts/{draft.Id}/publish", null)).ReadAsync<AdminPostDto>();
        Assert.Equal(PostStatus.Published, published.Status);
        Assert.NotNull(published.PublishedAt);
        var firstPublishedAt = published.PublishedAt;

        var detail = await anonymous.GetAsync<PostDetailDto>($"/api/posts/{Uri.EscapeDataString(draft.Slug)}");
        Assert.Equal("Draft **body**", detail.ContentMarkdown);
        Assert.Equal("Draft body", detail.Description); // excerpt fallback
        Assert.Equal(detail.Title, detail.SeoTitle);

        // Unpublish then republish: PublishedAt is unchanged.
        await (await admin.PostAsync($"/api/admin/posts/{draft.Id}/draft", null)).AssertStatusAsync(HttpStatusCode.OK);
        await (await anonymous.GetAsync($"/api/posts/{Uri.EscapeDataString(draft.Slug)}")).AssertStatusAsync(HttpStatusCode.NotFound);
        var republished = await (await admin.PostAsync($"/api/admin/posts/{draft.Id}/publish", null)).ReadAsync<AdminPostDto>();
        Assert.Equal(firstPublishedAt, republished.PublishedAt);
    }

    [Fact]
    public async Task Autosave_on_published_post_does_not_change_public_content_until_update()
    {
        var admin = await factory.CreateAdminClientAsync();
        var anonymous = factory.CreateBrowserClient();
        var post = await admin.CreatePostAsync("Working copy", "Live v1", publish: true);

        var autosave = await (await admin.PostJsonAsync($"/api/admin/posts/{post.Id}/autosave", new { contentMarkdown = "Editing v2" }))
            .ReadAsync<AutosaveResult>();
        Assert.True(autosave.HasWorkingCopy);

        var publicView = await anonymous.GetAsync<PostDetailDto>($"/api/posts/{post.Slug}");
        Assert.Equal("Live v1", publicView.ContentMarkdown);

        var adminView = await admin.GetAsync<AdminPostDto>($"/api/admin/posts/{post.Id}");
        Assert.Equal("Live v1", adminView.ContentMarkdown);
        Assert.Equal("Editing v2", adminView.EditingContentMarkdown);

        // Admin preview of the working copy through the public endpoint.
        var preview = await admin.GetAsync<PostDetailDto>($"/api/posts/{post.Slug}?preview=true");
        Assert.Equal("Editing v2", preview.ContentMarkdown);

        // Explicit update promotes the content and clears the working copy.
        var updated = await (await admin.PutJsonAsync($"/api/admin/posts/{post.Id}", HttpExtensions.PostRequest("Working copy", "Editing v2")))
            .ReadAsync<AdminPostDto>();
        Assert.False(updated.HasWorkingCopy);
        Assert.Equal(post.PublishedAt, updated.PublishedAt);
        Assert.Equal("Editing v2", (await anonymous.GetAsync<PostDetailDto>($"/api/posts/{post.Slug}")).ContentMarkdown);
    }

    [Fact]
    public async Task Autosave_on_draft_writes_content_directly()
    {
        var admin = await factory.CreateAdminClientAsync();
        var post = await admin.CreatePostAsync("Draft autosave", "v1");

        var result = await (await admin.PostJsonAsync($"/api/admin/posts/{post.Id}/autosave", new { contentMarkdown = "v2 draft", title = "Draft autosave 2" }))
            .ReadAsync<AutosaveResult>();
        Assert.False(result.HasWorkingCopy);

        var reloaded = await admin.GetAsync<AdminPostDto>($"/api/admin/posts/{post.Id}");
        Assert.Equal("v2 draft", reloaded.ContentMarkdown);
        Assert.Equal("Draft autosave 2", reloaded.Title);
        Assert.Equal("draft-autosave", reloaded.Slug); // slug is not regenerated from later title edits
    }

    [Fact]
    public async Task Private_post_is_visible_only_with_admin_cookie()
    {
        var admin = await factory.CreateAdminClientAsync();
        var anonymous = factory.CreateBrowserClient();
        var post = await admin.CreatePostAsync("Secret diary", "hidden");
        await (await admin.PostAsync($"/api/admin/posts/{post.Id}/private", null)).AssertStatusAsync(HttpStatusCode.OK);

        await (await anonymous.GetAsync($"/api/posts/{post.Slug}")).AssertStatusAsync(HttpStatusCode.NotFound);
        var asAdmin = await admin.GetAsync($"/api/posts/{post.Slug}");
        await asAdmin.AssertStatusAsync(HttpStatusCode.OK);
        Assert.True(asAdmin.Headers.CacheControl is { Private: true, NoStore: true });
        Assert.Equal(PostStatus.Private, (await asAdmin.ReadAsync<PostDetailDto>()).Status);

        var archive = await anonymous.GetAsync<List<PostSummaryDto>>("/api/archive");
        Assert.DoesNotContain(archive, p => p.Id == post.Id);
        var feed = await anonymous.GetAsync<List<FeedItemDto>>("/api/feed");
        Assert.DoesNotContain(feed, p => p.Id == post.Id);
        var sitemap = await anonymous.GetAsync<JsonElement>("/api/sitemap");
        Assert.DoesNotContain(sitemap.GetProperty("posts").EnumerateArray(), p => p.GetProperty("slug").GetString() == post.Slug);
    }

    [Fact]
    public async Task Soft_delete_restore_and_permanent_delete()
    {
        var admin = await factory.CreateAdminClientAsync();
        var anonymous = factory.CreateBrowserClient();
        var post = await admin.CreatePostAsync("Trash me", publish: true);

        await (await admin.DeleteAsync($"/api/admin/posts/{post.Id}")).AssertStatusAsync(HttpStatusCode.NoContent);
        await (await anonymous.GetAsync($"/api/posts/{post.Slug}")).AssertStatusAsync(HttpStatusCode.NotFound);

        var trash = await admin.GetAsync<PagedResult<AdminPostListItemDto>>("/api/admin/posts?trash=true");
        var trashed = Assert.Single(trash.Items, p => p.Id == post.Id);
        Assert.NotNull(trashed.PurgeAt);
        Assert.Equal(30, (int)Math.Round((trashed.PurgeAt!.Value - trashed.DeletedAt!.Value).TotalDays));
        var active = await admin.GetAsync<PagedResult<AdminPostListItemDto>>("/api/admin/posts");
        Assert.DoesNotContain(active.Items, p => p.Id == post.Id);

        // Editing a trashed post is refused.
        await (await admin.PostAsync($"/api/admin/posts/{post.Id}/publish", null)).AssertStatusAsync(HttpStatusCode.NotFound);

        var restored = await (await admin.PostAsync($"/api/admin/posts/{post.Id}/restore", null)).ReadAsync<AdminPostDto>();
        Assert.Null(restored.DeletedAt);
        await (await anonymous.GetAsync($"/api/posts/{post.Slug}")).AssertStatusAsync(HttpStatusCode.OK);

        await (await admin.DeleteAsync($"/api/admin/posts/{post.Id}/permanent")).AssertStatusAsync(HttpStatusCode.NoContent);
        await (await admin.GetAsync($"/api/admin/posts/{post.Id}")).AssertStatusAsync(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task Bulk_delete_moves_posts_to_trash()
    {
        var admin = await factory.CreateAdminClientAsync();
        var a = await admin.CreatePostAsync("Bulk A");
        var b = await admin.CreatePostAsync("Bulk B");

        var result = await (await admin.PostJsonAsync("/api/admin/posts/bulk-delete", new { ids = new[] { a.Id, b.Id } })).ReadAsync<BulkDeleteResult>();
        Assert.Equal(2, result.Deleted);
        var trash = await admin.GetAsync<PagedResult<AdminPostListItemDto>>("/api/admin/posts?trash=true&pageSize=100");
        Assert.Contains(trash.Items, p => p.Id == a.Id);
        Assert.Contains(trash.Items, p => p.Id == b.Id);
    }

    [Fact]
    public async Task Slugs_are_unique_and_explicit_collisions_are_rejected()
    {
        var admin = await factory.CreateAdminClientAsync();
        var first = await admin.CreatePostAsync("Same Title");
        var second = await admin.CreatePostAsync("Same Title");
        Assert.Equal("same-title", first.Slug);
        Assert.Equal("same-title-2", second.Slug);

        var conflict = await admin.PostJsonAsync("/api/admin/posts", HttpExtensions.PostRequest("Other", slug: "Same Title"));
        await conflict.AssertStatusAsync(HttpStatusCode.BadRequest);
        Assert.True((await conflict.JsonAsync()).GetProperty("errors").TryGetProperty("slug", out _));
    }

    [Fact]
    public async Task Public_detail_has_navigation_related_and_series()
    {
        var admin = await factory.CreateAdminClientAsync();
        var anonymous = factory.CreateBrowserClient();
        var series = await (await admin.PostJsonAsync("/api/admin/series", new { title = "Nav Series" })).ReadAsync<JsonElement>();
        var seriesId = series.GetProperty("series").GetProperty("id").GetGuid();

        var p1 = await admin.CreatePostAsync("Nav one", tags: ["navtag"], seriesId: seriesId, publish: true);
        var p2 = await admin.CreatePostAsync("Nav two", tags: ["navtag"], seriesId: seriesId, publish: true);
        var p3 = await admin.CreatePostAsync("Nav three", tags: ["navtag"], publish: true);

        var detail = await anonymous.GetAsync<PostDetailDto>($"/api/posts/{p2.Slug}");
        Assert.Equal(p1.Slug, detail.Previous?.Slug); // older
        Assert.Equal(p3.Slug, detail.Next?.Slug);     // newer
        Assert.Contains(detail.Related, r => r.Slug == p1.Slug);
        Assert.Equal([p1.Slug, p2.Slug], detail.SeriesPosts.Select(s => s.Slug));
        Assert.Equal(2, detail.Series?.Order);
    }
}
