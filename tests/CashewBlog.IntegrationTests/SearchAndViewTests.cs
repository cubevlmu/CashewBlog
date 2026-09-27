using System.Net;
using System.Text.Json;
using CashewBlog.Application.Analytics;
using CashewBlog.Application.Posts;
using CashewBlog.Application.Search;
using CashewBlog.IntegrationTests.Infrastructure;

namespace CashewBlog.IntegrationTests;

public class SearchTests(CashewBlogFactory factory) : IClassFixture<CashewBlogFactory>
{
    [Fact]
    public async Task Ranks_title_matches_first_and_highlights_safely()
    {
        var admin = await factory.CreateAdminClientAsync();
        var body = await admin.CreatePostAsync("Cooking notes", "Today I tried a new Postgres trick in the kitchen <b>bold</b>.", publish: true);
        var title = await admin.CreatePostAsync("Postgres", "All about databases.", publish: true);
        var prefix = await admin.CreatePostAsync("Postgres indexing tips", "Some text.", publish: true);
        var tagged = await admin.CreatePostAsync("Unrelated heading", "Nothing here.", tags: ["postgres"], publish: true);
        var draft = await admin.CreatePostAsync("Postgres draft", "secret postgres");

        var result = await factory.CreateBrowserClient().GetAsync<SearchResultDto>("/api/search?q=postgres");
        var slugs = result.Items.Select(i => i.Slug).ToList();

        Assert.DoesNotContain(draft.Slug, slugs);
        Assert.Equal(4, result.TotalItems);
        Assert.Equal(title.Slug, slugs[0]);  // exact title
        Assert.Equal(prefix.Slug, slugs[1]); // title prefix
        Assert.True(slugs.IndexOf(tagged.Slug) < slugs.IndexOf(body.Slug), "tag match should outrank body-only match");

        var bodyHit = result.Items.Single(i => i.Slug == body.Slug);
        Assert.Contains("<mark>Postgres</mark>", bodyHit.SnippetHtml);
        Assert.DoesNotContain("<b>", bodyHit.SnippetHtml);
        Assert.Equal("<mark>Postgres</mark>", result.Items[0].TitleHtml);
        Assert.Equal(["postgres"], result.Items.Single(i => i.Slug == tagged.Slug).MatchedTags);
    }

    [Fact]
    public async Task Finds_chinese_text()
    {
        var admin = await factory.CreateAdminClientAsync();
        var post = await admin.CreatePostAsync("数据库笔记", "我们今天学习了全文搜索和倒排索引的实现原理。", publish: true);
        await admin.CreatePostAsync("无关文章", "天气很好。", publish: true);

        var result = await factory.CreateBrowserClient().GetAsync<SearchResultDto>($"/api/search?q={Uri.EscapeDataString("倒排索引")}");

        var hit = Assert.Single(result.Items);
        Assert.Equal(post.Slug, hit.Slug);
        Assert.Contains("<mark>倒排索引</mark>", hit.SnippetHtml);
    }

    [Fact]
    public async Task Empty_query_and_wildcards()
    {
        var client = factory.CreateBrowserClient();
        var empty = await client.GetAsync<SearchResultDto>("/api/search?q=");
        Assert.Empty(empty.Items);

        // LIKE wildcards are literal: '%' must not match everything.
        var percent = await client.GetAsync<SearchResultDto>("/api/search?q=%25");
        Assert.Empty(percent.Items);
    }
}

public class ViewCountTests(CashewBlogFactory factory) : IClassFixture<CashewBlogFactory>
{
    private static async Task<ViewResult> ViewAsync(HttpClient client, string slug, string userAgent)
    {
        using var request = new HttpRequestMessage(HttpMethod.Post, $"/api/posts/{Uri.EscapeDataString(slug)}/view");
        request.Headers.TryAddWithoutValidation("User-Agent", userAgent);
        return await (await client.SendAsync(request)).ReadAsync<ViewResult>();
    }

    [Fact]
    public async Task Views_are_deduplicated_per_visitor()
    {
        var admin = await factory.CreateAdminClientAsync();
        var client = factory.CreateBrowserClient();
        var post = await admin.CreatePostAsync("Viewed post", publish: true);

        var first = await ViewAsync(client, post.Slug, "Browser A");
        var again = await ViewAsync(client, post.Slug, "Browser A");
        var other = await ViewAsync(client, post.Slug, "Browser B");

        Assert.True(first.Counted);
        Assert.Equal(1, first.ViewCount);
        Assert.False(again.Counted);
        Assert.Equal(1, again.ViewCount);
        Assert.True(other.Counted);
        Assert.Equal(2, other.ViewCount);

        var detail = await client.GetAsync<PostDetailDto>($"/api/posts/{post.Slug}");
        Assert.Equal(2, detail.ViewCount);

        var overview = await admin.GetAsync<AnalyticsOverviewDto>("/api/admin/analytics/overview?range=7d");
        Assert.Equal(7, overview.Daily.Count);
        Assert.True(overview.TodayViews >= 2);
        Assert.Contains(overview.TopPosts, p => p.Id == post.Id && p.ViewCount == 2);

        var perPost = await admin.GetAsync<JsonElement>("/api/admin/analytics/posts?sort=today");
        var row = perPost.GetProperty("items").EnumerateArray().Single(i => i.GetProperty("id").GetGuid() == post.Id);
        Assert.Equal(2, row.GetProperty("todayViews").GetInt64());
    }

    [Fact]
    public async Task Draft_and_private_posts_are_not_counted()
    {
        var admin = await factory.CreateAdminClientAsync();
        var draft = await admin.CreatePostAsync("Unviewable draft");
        var response = await factory.CreateBrowserClient().PostAsync($"/api/posts/{draft.Slug}/view", null);
        await response.AssertStatusAsync(HttpStatusCode.NotFound);
    }
}
