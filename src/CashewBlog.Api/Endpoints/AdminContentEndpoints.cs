using System.Text.Json;
using CashewBlog.Application.Common;
using CashewBlog.Application.CustomPages;
using CashewBlog.Application.Posts;
using CashewBlog.Application.Taxonomy;
using CashewBlog.Domain.Entities;

namespace CashewBlog.Api.Endpoints;

/// <summary>Case-insensitive enum parsing for query strings (e.g. <c>?status=draft</c>).</summary>
public static class QueryEnum
{
    public static T? Parse<T>(string? value, string field) where T : struct, Enum
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return null;
        }

        if (Enum.TryParse<T>(value, ignoreCase: true, out var parsed) && Enum.IsDefined(parsed) && !int.TryParse(value, out _))
        {
            return parsed;
        }

        throw new ValidationException(field, $"Unknown value '{value}'. Allowed: {string.Join(", ", Enum.GetNames<T>().Select(JsonNamingPolicy.CamelCase.ConvertName))}.");
    }
}

/// <summary>Admin CRUD for posts, taxonomy, series and custom pages.</summary>
public static class AdminContentEndpoints
{
    public static void MapAdminContentEndpoints(this RouteGroupBuilder admin)
    {
        MapPosts(admin.MapGroup("/posts").WithTags("Admin: posts"));
        MapTaxonomy(admin);
        MapPages(admin.MapGroup("/pages").WithTags("Admin: pages"));
    }

    private static void MapPosts(RouteGroupBuilder posts)
    {
        posts.MapGet("/", (string? q, string? status, Guid? categoryId, Guid? tagId, Guid? seriesId, bool? trash,
                string? sort, string? order, int? page, int? pageSize, PostService service, CancellationToken ct) =>
            service.ListAsync(new AdminPostQuery(q, QueryEnum.Parse<PostStatus>(status, "status"), categoryId, tagId, seriesId,
                trash == true, sort, order, page, pageSize), ct));

        posts.MapPost("/", async (UpsertPostRequest request, PostService service, CancellationToken ct) =>
        {
            var post = await service.CreateAsync(request, ct);
            return Results.Created($"/api/admin/posts/{post.Id}", post);
        });

        posts.MapGet("/{id:guid}", (Guid id, PostService service, CancellationToken ct) => service.GetAsync(id, ct));
        posts.MapPut("/{id:guid}", (Guid id, UpsertPostRequest request, PostService service, CancellationToken ct) => service.UpdateAsync(id, request, ct));

        posts.MapDelete("/{id:guid}", async (Guid id, PostService service, CancellationToken ct) =>
        {
            await service.SoftDeleteAsync(id, ct);
            return Results.NoContent();
        });

        // Transitions accept an optional body: when present it is saved first (atomic "save + publish").
        posts.MapPost("/{id:guid}/publish", async (Guid id, HttpContext context, PostService service, CancellationToken ct) =>
            await service.PublishAsync(id, await ReadOptionalBodyAsync<UpsertPostRequest>(context, ct), ct));
        posts.MapPost("/{id:guid}/private", async (Guid id, HttpContext context, PostService service, CancellationToken ct) =>
            await service.MakePrivateAsync(id, await ReadOptionalBodyAsync<UpsertPostRequest>(context, ct), ct));
        posts.MapPost("/{id:guid}/draft", async (Guid id, HttpContext context, PostService service, CancellationToken ct) =>
            await service.MakeDraftAsync(id, await ReadOptionalBodyAsync<UpsertPostRequest>(context, ct), ct));
        posts.MapPost("/{id:guid}/autosave", (Guid id, AutosavePostRequest request, PostService service, CancellationToken ct) => service.AutosaveAsync(id, request, ct));
        posts.MapPost("/{id:guid}/restore", (Guid id, PostService service, CancellationToken ct) => service.RestoreAsync(id, ct));

        posts.MapDelete("/{id:guid}/permanent", async (Guid id, PostService service, CancellationToken ct) =>
        {
            await service.DeletePermanentlyAsync(id, ct);
            return Results.NoContent();
        });

        posts.MapPost("/bulk-delete", (BulkDeleteRequest request, PostService service, CancellationToken ct) => service.BulkSoftDeleteAsync(request, ct));
    }

    /// <summary>
    /// Reads a JSON body when one is sent. (A nullable body parameter would make routing require a
    /// JSON content type, so body-less POSTs would not match the endpoint.)
    /// </summary>
    private static async Task<T?> ReadOptionalBodyAsync<T>(HttpContext context, CancellationToken ct) where T : class
    {
        if (context.Request.ContentLength is null or 0 && !context.Request.Headers.TransferEncoding.Any())
        {
            return null;
        }

        return await context.Request.ReadFromJsonAsync<T>(AppJson.Options, ct);
    }

    private static void MapTaxonomy(RouteGroupBuilder admin)
    {
        var categories = admin.MapGroup("/categories").WithTags("Admin: taxonomy");
        categories.MapGet("/", (TaxonomyService s, CancellationToken ct) => s.ListCategoriesAsync(ct));
        categories.MapPost("/", async (UpsertCategoryRequest r, TaxonomyService s, CancellationToken ct) =>
        {
            var created = await s.CreateCategoryAsync(r, ct);
            return Results.Created($"/api/admin/categories/{created.Id}", created);
        });
        categories.MapPut("/{id:guid}", (Guid id, UpsertCategoryRequest r, TaxonomyService s, CancellationToken ct) => s.UpdateCategoryAsync(id, r, ct));
        categories.MapDelete("/{id:guid}", async (Guid id, TaxonomyService s, CancellationToken ct) =>
        {
            await s.DeleteCategoryAsync(id, ct);
            return Results.NoContent();
        });

        var tags = admin.MapGroup("/tags").WithTags("Admin: taxonomy");
        tags.MapGet("/", (TaxonomyService s, CancellationToken ct) => s.ListTagsAsync(ct));
        tags.MapPost("/", async (UpsertTagRequest r, TaxonomyService s, CancellationToken ct) =>
        {
            var created = await s.CreateTagAsync(r, ct);
            return Results.Created($"/api/admin/tags/{created.Id}", created);
        });
        tags.MapPut("/{id:guid}", (Guid id, UpsertTagRequest r, TaxonomyService s, CancellationToken ct) => s.UpdateTagAsync(id, r, ct));
        tags.MapDelete("/{id:guid}", async (Guid id, TaxonomyService s, CancellationToken ct) =>
        {
            await s.DeleteTagAsync(id, ct);
            return Results.NoContent();
        });

        var series = admin.MapGroup("/series").WithTags("Admin: taxonomy");
        series.MapGet("/", (TaxonomyService s, CancellationToken ct) => s.ListSeriesAsync(ct));
        series.MapGet("/{id:guid}", (Guid id, TaxonomyService s, CancellationToken ct) => s.GetSeriesAsync(id, ct));
        series.MapPost("/", async (UpsertSeriesRequest r, TaxonomyService s, CancellationToken ct) =>
        {
            var created = await s.CreateSeriesAsync(r, ct);
            return Results.Created($"/api/admin/series/{created.Series.Id}", created);
        });
        series.MapPut("/{id:guid}", (Guid id, UpsertSeriesRequest r, TaxonomyService s, CancellationToken ct) => s.UpdateSeriesAsync(id, r, ct));
        series.MapPut("/{id:guid}/order", (Guid id, ReorderSeriesRequest r, TaxonomyService s, CancellationToken ct) => s.ReorderSeriesAsync(id, r, ct));
        series.MapDelete("/{id:guid}", async (Guid id, TaxonomyService s, CancellationToken ct) =>
        {
            await s.DeleteSeriesAsync(id, ct);
            return Results.NoContent();
        });
    }

    private static void MapPages(RouteGroupBuilder pages)
    {
        pages.MapGet("/", (CustomPageService s, CancellationToken ct) => s.ListAsync(ct));
        pages.MapGet("/{id:guid}", (Guid id, CustomPageService s, CancellationToken ct) => s.GetAsync(id, ct));
        pages.MapPost("/", async (UpsertCustomPageRequest r, CustomPageService s, CancellationToken ct) =>
        {
            var created = await s.CreateAsync(r, ct);
            return Results.Created($"/api/admin/pages/{created.Id}", created);
        });
        pages.MapPut("/{id:guid}", (Guid id, UpsertCustomPageRequest r, CustomPageService s, CancellationToken ct) => s.UpdateAsync(id, r, ct));
        pages.MapDelete("/{id:guid}", async (Guid id, CustomPageService s, CancellationToken ct) =>
        {
            await s.DeleteAsync(id, ct);
            return Results.NoContent();
        });
    }
}
