using System.Text.Json;
using CashewBlog.Application.Common;
using CashewBlog.Application.Posts;
using CashewBlog.IntegrationTests.Infrastructure;
using Microsoft.Extensions.DependencyInjection;
using Npgsql;

namespace CashewBlog.IntegrationTests;

public class PublicReadModelTests(CashewBlogFactory factory) : IClassFixture<CashewBlogFactory>
{
    [Fact]
    public async Task Bootstrap_feed_sitemap_and_ordering()
    {
        var admin = await factory.CreateAdminClientAsync();
        var anonymous = factory.CreateBrowserClient();
        var category = await (await admin.PostJsonAsync("/api/admin/categories", new { name = "Read Model" })).ReadAsync<JsonElement>();
        var older = await admin.CreatePostAsync("Older post", "one two three", tags: ["rm"], categoryId: category.GetProperty("id").GetGuid(), publish: true);
        var newer = await admin.CreatePostAsync("Newer post", "你好世界", publish: true);

        // Pin the older post: pinned first, then PublishedAt DESC.
        var pinRequest = HttpExtensions.PostRequest("Older post", "one two three", ["rm"], category.GetProperty("id").GetGuid()) with { IsPinned = true };
        await (await admin.PutJsonAsync($"/api/admin/posts/{older.Id}", pinRequest)).ReadAsync<AdminPostDto>();

        var page = await anonymous.GetAsync<PagedResult<PostSummaryDto>>("/api/posts?pageSize=10");
        Assert.Equal([older.Slug, newer.Slug], page.Items.Select(p => p.Slug).Take(2));
        Assert.True(page.Items[0].IsPinned);
        Assert.Equal(3, page.Items[0].WordCount);
        Assert.Equal(4, page.Items[1].WordCount);

        var bootstrap = await anonymous.GetAsync<JsonElement>("/api/site/bootstrap");
        var stats = bootstrap.GetProperty("stats");
        Assert.Equal(2, stats.GetProperty("postCount").GetInt32());
        Assert.Equal(7, stats.GetProperty("totalWords").GetInt64());
        Assert.Contains(bootstrap.GetProperty("categories").EnumerateArray(), c => c.GetProperty("slug").GetString() == "read-model" && c.GetProperty("count").GetInt32() == 1);
        Assert.Contains(bootstrap.GetProperty("tags").EnumerateArray(), t => t.GetProperty("slug").GetString() == "rm");
        Assert.Equal(newer.Slug, bootstrap.GetProperty("recentPosts")[0].GetProperty("slug").GetString());
        Assert.False(string.IsNullOrEmpty(bootstrap.GetProperty("version").GetString()));

        var feed = await anonymous.GetAsync<List<FeedItemDto>>("/api/feed?limit=1");
        var item = Assert.Single(feed);
        Assert.Equal(newer.Slug, item.Slug);
        Assert.Equal("你好世界", item.ContentMarkdown);

        var sitemap = await anonymous.GetAsync<JsonElement>("/api/sitemap");
        Assert.Equal(2, sitemap.GetProperty("posts").GetArrayLength());
        Assert.Equal("read-model", sitemap.GetProperty("categories")[0].GetString());

        var tagPosts = await anonymous.GetAsync<JsonElement>("/api/tags/rm/posts");
        Assert.Equal("rm", tagPosts.GetProperty("tag").GetProperty("slug").GetString());
        Assert.Equal(1, tagPosts.GetProperty("posts").GetProperty("totalItems").GetInt32());
    }

    [Fact]
    public async Task Maintenance_purges_expired_trash()
    {
        var admin = await factory.CreateAdminClientAsync();
        var keep = await admin.CreatePostAsync("Recently trashed");
        var purge = await admin.CreatePostAsync("Long trashed");
        await admin.DeleteAsync($"/api/admin/posts/{keep.Id}");
        await admin.DeleteAsync($"/api/admin/posts/{purge.Id}");

        // Simulate 31 days passing for one of them.
        await using (var connection = new NpgsqlConnection(factory.Database.ConnectionString))
        {
            await connection.OpenAsync();
            await using var cmd = new NpgsqlCommand("""UPDATE "Posts" SET "PurgeAt" = now() - interval '1 day' WHERE "Id" = @id""", connection);
            cmd.Parameters.AddWithValue("id", purge.Id);
            await cmd.ExecuteNonQueryAsync();
        }

        using (var scope = factory.Services.CreateScope())
        {
            var purged = await scope.ServiceProvider.GetRequiredService<PostService>().PurgeExpiredAsync(CancellationToken.None);
            Assert.Equal(1, purged);
        }

        var trash = await admin.GetAsync<PagedResult<AdminPostListItemDto>>("/api/admin/posts?trash=true&pageSize=100");
        Assert.Contains(trash.Items, p => p.Id == keep.Id);
        Assert.DoesNotContain(trash.Items, p => p.Id == purge.Id);
    }
}
