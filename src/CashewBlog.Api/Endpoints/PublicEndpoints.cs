using CashewBlog.Api.Hosting;
using CashewBlog.Application.Analytics;
using CashewBlog.Application.CustomPages;
using CashewBlog.Application.Posts;
using CashewBlog.Application.Search;
using CashewBlog.Application.Settings;
using CashewBlog.Application.Taxonomy;
using CashewBlog.Domain.Entities;

namespace CashewBlog.Api.Endpoints;

/// <summary>Anonymous read API used by the Astro SSR server (and the browser for views/search).</summary>
public static class PublicEndpoints
{
    public static void MapPublicEndpoints(this IEndpointRouteBuilder app)
    {
        var api = app.MapGroup("/api").WithTags("Public");

        api.MapGet("/site/bootstrap", async (HttpContext context, PublicCache cache, BootstrapService service, CancellationToken ct) =>
        {
            var cached = await cache.GetBootstrapAsync(service, ct);
            context.Response.Headers.ETag = cached.ETag;
            context.Response.Headers.CacheControl = "no-cache";
            if (context.Request.Headers.IfNoneMatch.ToString().Split(',').Any(t => t.Trim() == cached.ETag))
            {
                return Results.StatusCode(StatusCodes.Status304NotModified);
            }

            return Results.Bytes(cached.Body, "application/json; charset=utf-8");
        });

        // ------------------------------------------------------------------ posts

        api.MapGet("/posts", (int? page, int? pageSize, string? category, string? tag, string? series, PublicPostService posts, CancellationToken ct) =>
            posts.ListAsync(new PostListQuery(page, pageSize, category, tag, series), ct));

        api.MapGet("/posts/{slug}", async (string slug, bool? preview, HttpContext context, PublicPostService posts, CancellationToken ct) =>
        {
            var isAdmin = context.User.Identity?.IsAuthenticated == true;
            var post = await posts.GetAsync(slug, isAdmin, preview == true, ct);
            if (post is null)
            {
                return ApiErrors.NotFound("Post not found.");
            }

            // Never let shared caches keep admin-only content.
            context.Response.Headers.CacheControl = post.Status == PostStatus.Published && preview != true
                ? "no-cache"
                : "private, no-store";
            return Results.Ok(post);
        });

        api.MapPost("/posts/{slug}/view", async (string slug, HttpContext context, AnalyticsService analytics, CancellationToken ct) =>
        {
            var result = await analytics.RecordViewAsync(
                slug,
                context.Connection.RemoteIpAddress?.ToString(),
                context.Request.Headers.UserAgent.ToString(),
                ct);
            context.Response.Headers.CacheControl = "no-store";
            return result is null ? ApiErrors.NotFound("Post not found.") : Results.Ok(result);
        });

        api.MapGet("/archive", (PublicPostService posts, CancellationToken ct) => posts.ArchiveAsync(ct));

        api.MapGet("/feed", (int? limit, PublicPostService posts, CancellationToken ct) => posts.FeedAsync(limit, ct));

        api.MapGet("/sitemap", (PublicPostService posts, TaxonomyService taxonomy, CancellationToken ct) => posts.SitemapAsync(taxonomy, ct));

        // --------------------------------------------------------------- taxonomy

        api.MapGet("/categories", (TaxonomyService taxonomy, CancellationToken ct) => taxonomy.PublicCategoriesAsync(ct));

        api.MapGet("/categories/{slug}/posts", async (string slug, int? page, int? pageSize, TaxonomyService taxonomy, PublicPostService posts, CancellationToken ct) =>
        {
            var category = await taxonomy.PublicCategoryAsync(slug, ct);
            var list = await posts.ListAsync(new PostListQuery(page, pageSize, slug, null, null), ct);
            return Results.Ok(new { category, posts = list });
        });

        api.MapGet("/tags", (TaxonomyService taxonomy, CancellationToken ct) => taxonomy.PublicTagsAsync(ct));

        api.MapGet("/tags/{slug}/posts", async (string slug, int? page, int? pageSize, TaxonomyService taxonomy, PublicPostService posts, CancellationToken ct) =>
        {
            var tag = await taxonomy.PublicTagAsync(slug, ct);
            var list = await posts.ListAsync(new PostListQuery(page, pageSize, null, slug, null), ct);
            return Results.Ok(new { tag, posts = list });
        });

        api.MapGet("/series", (TaxonomyService taxonomy, CancellationToken ct) => taxonomy.PublicSeriesAsync(ct));

        api.MapGet("/series/{slug}", (string slug, PublicPostService posts, CancellationToken ct) => posts.GetSeriesAsync(slug, ct));

        // ------------------------------------------------------- pages and search

        api.MapGet("/pages/{**slug}", async (string slug, CustomPageService pages, CancellationToken ct) =>
        {
            var page = await pages.GetPublicAsync(slug, ct);
            return page is null ? ApiErrors.NotFound("Page not found.") : Results.Ok(page);
        });

        api.MapGet("/search", (string? q, int? page, int? pageSize, ISearchService search, CancellationToken ct) =>
            search.SearchAsync(q, page, pageSize, ct));
    }

    /// <summary>Unknown /api routes return JSON 404 instead of falling through to the web proxy.</summary>
    public static void MapApiFallback(this IEndpointRouteBuilder app)
    {
        app.Map("/api/{**rest}", () => ApiErrors.NotFound("Unknown API endpoint.")).ExcludeFromDescription();
    }
}
