using System.Net;
using System.Text.Json;
using CashewBlog.Application.Common;
using CashewBlog.Application.Posts;
using CashewBlog.Application.Taxonomy;
using CashewBlog.IntegrationTests.Infrastructure;

namespace CashewBlog.IntegrationTests;

public class TaxonomyTests(CashewBlogFactory factory) : IClassFixture<CashewBlogFactory>
{
    [Fact]
    public async Task Deleting_a_category_uncategorizes_posts()
    {
        var admin = await factory.CreateAdminClientAsync();
        var category = await (await admin.PostJsonAsync("/api/admin/categories", new { name = "技术" })).ReadAsync<AdminCategoryDto>();
        Assert.Equal("技术", category.Slug);
        var post = await admin.CreatePostAsync("Categorized", categoryId: category.Id, publish: true);

        var categories = await admin.GetAsync<List<AdminCategoryDto>>("/api/admin/categories");
        Assert.Equal(1, categories.Single(c => c.Id == category.Id).PostCount);

        var publicList = await factory.CreateBrowserClient().GetAsync<List<CategorySummaryDto>>("/api/categories");
        Assert.Equal(1, publicList.Single(c => c.Slug == "技术").Count);

        await (await admin.DeleteAsync($"/api/admin/categories/{category.Id}")).AssertStatusAsync(HttpStatusCode.NoContent);
        var reloaded = await admin.GetAsync<AdminPostDto>($"/api/admin/posts/{post.Id}");
        Assert.Null(reloaded.CategoryId);
        Assert.Null(reloaded.Category);
    }

    [Fact]
    public async Task Deleting_a_tag_removes_only_associations()
    {
        var admin = await factory.CreateAdminClientAsync();
        var post = await admin.CreatePostAsync("Tagged", tags: ["keep", "drop-me"], publish: true);
        var dropId = post.Tags.Single(t => t.Name == "drop-me").Id;

        await (await admin.DeleteAsync($"/api/admin/tags/{dropId}")).AssertStatusAsync(HttpStatusCode.NoContent);

        var reloaded = await admin.GetAsync<AdminPostDto>($"/api/admin/posts/{post.Id}");
        Assert.Equal(["keep"], reloaded.Tags.Select(t => t.Name));
        var tags = await admin.GetAsync<List<AdminTagDto>>("/api/admin/tags");
        Assert.DoesNotContain(tags, t => t.Id == dropId);
    }

    [Fact]
    public async Task Tags_are_reused_case_insensitively()
    {
        var admin = await factory.CreateAdminClientAsync();
        var a = await admin.CreatePostAsync("Tag reuse A", tags: ["Rust"]);
        var b = await admin.CreatePostAsync("Tag reuse B", tags: ["rust"]);
        Assert.Equal(a.Tags.Single().Id, b.Tags.Single().Id);
    }

    [Fact]
    public async Task Deleting_a_series_keeps_posts_and_clears_order()
    {
        var admin = await factory.CreateAdminClientAsync();
        var created = await (await admin.PostJsonAsync("/api/admin/series", new { title = "Temp Series", status = "completed" }))
            .ReadAsync<AdminSeriesDetailDto>();
        var post = await admin.CreatePostAsync("In series", seriesId: created.Series.Id);
        Assert.Equal(1, post.SeriesOrder);

        await (await admin.DeleteAsync($"/api/admin/series/{created.Series.Id}")).AssertStatusAsync(HttpStatusCode.NoContent);
        var reloaded = await admin.GetAsync<AdminPostDto>($"/api/admin/posts/{post.Id}");
        Assert.Null(reloaded.SeriesId);
        Assert.Null(reloaded.SeriesOrder);
    }

    [Fact]
    public async Task Series_reorder_and_default_category_as_effective_category()
    {
        var admin = await factory.CreateAdminClientAsync();
        var anonymous = factory.CreateBrowserClient();
        var category = await (await admin.PostJsonAsync("/api/admin/categories", new { name = "Series Cat" })).ReadAsync<AdminCategoryDto>();
        var series = await (await admin.PostJsonAsync("/api/admin/series", new { title = "Ordered", defaultCategoryId = category.Id }))
            .ReadAsync<AdminSeriesDetailDto>();
        var id = series.Series.Id;

        var first = await admin.CreatePostAsync("Part A", seriesId: id, publish: true);
        var second = await admin.CreatePostAsync("Part B", seriesId: id, publish: true);

        var reordered = await (await admin.PutJsonAsync($"/api/admin/series/{id}/order", new { postIds = new[] { second.Id, first.Id } }))
            .ReadAsync<AdminSeriesDetailDto>();
        Assert.Equal([second.Id, first.Id], reordered.Posts.Select(p => p.Id));

        var detail = await anonymous.GetAsync<SeriesDetailDto>($"/api/series/{series.Series.Slug}");
        Assert.Equal(["part-b", "part-a"], detail.Posts.Select(p => p.Slug));
        Assert.Equal("series-cat", detail.DefaultCategory?.Slug);
        Assert.NotNull(detail.LatestPublishedAt);

        // The posts have no own category but inherit the series default publicly.
        var summary = detail.Posts[0];
        Assert.Equal("series-cat", summary.Category?.Slug);
        var byCategory = await anonymous.GetAsync<PagedResult<PostSummaryDto>>("/api/posts?category=series-cat");
        Assert.Equal(2, byCategory.TotalItems);
        var categories = await anonymous.GetAsync<List<CategorySummaryDto>>("/api/categories");
        Assert.Equal(2, categories.Single(c => c.Slug == "series-cat").Count);

        var list = await anonymous.GetAsync<List<SeriesSummaryDto>>("/api/series");
        Assert.Equal(2, list.Single(s => s.Slug == series.Series.Slug).Count);
    }

    [Fact]
    public async Task Category_posts_endpoint_and_duplicate_names()
    {
        var admin = await factory.CreateAdminClientAsync();
        await (await admin.PostJsonAsync("/api/admin/categories", new { name = "Unique" })).AssertStatusAsync(HttpStatusCode.Created);
        var duplicate = await admin.PostJsonAsync("/api/admin/categories", new { name = "unique" });
        await duplicate.AssertStatusAsync(HttpStatusCode.BadRequest);

        await (await factory.CreateBrowserClient().GetAsync("/api/categories/does-not-exist/posts")).AssertStatusAsync(HttpStatusCode.NotFound);
        var result = await factory.CreateBrowserClient().GetAsync<JsonElement>("/api/categories/unique/posts");
        Assert.Equal(0, result.GetProperty("posts").GetProperty("totalItems").GetInt32());
    }
}
