using System.Globalization;
using System.Text.Json;
using CashewBlog.Api.Hosting;
using CashewBlog.Application.Abstractions;
using CashewBlog.Application.Admin;
using CashewBlog.Application.Analytics;
using CashewBlog.Application.Common;
using CashewBlog.Application.Media;
using CashewBlog.Application.Settings;
using CashewBlog.Domain.Entities;
using Microsoft.AspNetCore.Http.Features;
using Microsoft.AspNetCore.StaticFiles;

namespace CashewBlog.Api.Endpoints;

/// <summary>Admin media, settings, analytics, system info and exports.</summary>
public static class AdminSystemEndpoints
{
    private static readonly FileExtensionContentTypeProvider ContentTypes = new();

    public static void MapAdminSystemEndpoints(this RouteGroupBuilder admin)
    {
        MapMedia(admin.MapGroup("/media").WithTags("Admin: media"));
        MapSettings(admin.MapGroup("/settings").WithTags("Admin: settings"));

        var analytics = admin.MapGroup("/analytics").WithTags("Admin: analytics");
        analytics.MapGet("/overview", (string? range, AnalyticsService s, CancellationToken ct) => s.OverviewAsync(range, ct));
        analytics.MapGet("/posts", (string? sort, int? page, int? pageSize, AnalyticsService s, CancellationToken ct) => s.PostsAsync(sort, page, pageSize, ct));

        var system = admin.MapGroup("/system").WithTags("Admin: system");
        system.MapGet("/info", (ISystemInfoService s, CancellationToken ct) => s.GetInfoAsync(ct));
        system.MapGet("/health", async (ISystemInfoService s, IMediaStorage storage, WebUpstreamProbe web, CancellationToken ct) =>
        {
            var db = await s.CheckDatabaseAsync(ct);
            var (webOk, webDetail) = await web.CheckAsync(ct);
            var storageOk = Directory.Exists(storage.RootPath);
            HealthComponentDto[] components =
            [
                new("database", db.Healthy, db.Healthy ? $"PostgreSQL {db.ServerVersion}, {db.LatencyMs} ms" : db.Error),
                new("web", webOk, webDetail),
                new("storage", storageOk, storage.RootPath),
            ];
            return new SystemHealthDto(components.All(c => c.Healthy), components);
        });

        var export = admin.MapGroup("/export").WithTags("Admin: export");
        export.MapGet("/settings", async (SettingsService settings, IClock clock, CancellationToken ct) =>
        {
            var body = JsonSerializer.SerializeToUtf8Bytes(await settings.GetAsync(ct), new JsonSerializerOptions(AppJson.Options) { WriteIndented = true });
            return Results.File(body, "application/json", $"cashewblog-settings-{clock.UtcNow:yyyyMMdd}.json");
        });
        export.MapGet("/posts", async (ExportService exporter, IClock clock, CancellationToken ct) =>
        {
            var buffer = new MemoryStream();
            await exporter.WritePostsZipAsync(buffer, ct);
            buffer.Position = 0;
            return Results.File(buffer, "application/zip", $"cashewblog-posts-{clock.UtcNow:yyyyMMdd}.zip");
        });
    }

    private static void MapMedia(RouteGroupBuilder media)
    {
        media.MapGet("/", (string? kind, string? q, string? sort, int? page, int? pageSize, MediaService s, CancellationToken ct) =>
            s.ListAsync(new MediaQuery(QueryEnum.Parse<MediaKind>(kind, "kind"), q, sort, page, pageSize), ct));

        media.MapGet("/{id:guid}", (Guid id, MediaService s, CancellationToken ct) => s.GetAsync(id, ct));

        // Multipart form: "file" (required) and "altText" (optional). The form is read manually so the
        // size limit can follow the runtime config (Storage.MaxUploadBytes).
        media.MapPost("/", async (HttpContext context, MediaService s, IConfigStore config, CancellationToken ct) =>
        {
            var max = config.MaxUploadBytes;
            var envelope = max + 1024 * 1024; // multipart overhead
            if (context.Features.Get<IHttpMaxRequestBodySizeFeature>() is { IsReadOnly: false } sizeFeature)
            {
                sizeFeature.MaxRequestBodySize = envelope;
            }

            if (context.Request.ContentLength > envelope)
            {
                return TooLarge(max);
            }

            if (!context.Request.HasFormContentType)
            {
                return ApiErrors.Problem(StatusCodes.Status400BadRequest, "bad_request", "Expected multipart/form-data with a 'file' field.");
            }

            IFormCollection form;
            try
            {
                form = await context.Request.ReadFormAsync(new FormOptions { MultipartBodyLengthLimit = envelope }, ct);
            }
            catch (InvalidDataException)
            {
                return TooLarge(max);
            }
            catch (BadHttpRequestException ex) when (ex.StatusCode == StatusCodes.Status413PayloadTooLarge)
            {
                return TooLarge(max);
            }

            var file = form.Files.GetFile("file") ?? form.Files.FirstOrDefault();
            if (file is null)
            {
                throw new ValidationException("file", "A file is required.");
            }

            if (file.Length > max)
            {
                return TooLarge(max);
            }

            var contentType = file.ContentType;
            if (string.IsNullOrWhiteSpace(contentType) || contentType == "application/octet-stream")
            {
                contentType = ContentTypes.TryGetContentType(file.FileName, out var guessed) ? guessed : "application/octet-stream";
            }

            // Spool to a temp file: the pipeline needs a seekable stream (hash, probe, variants).
            var tempPath = Path.Combine(Path.GetTempPath(), $"cashewblog-upload-{Guid.NewGuid():N}");
            await using var temp = new FileStream(tempPath, FileMode.CreateNew, FileAccess.ReadWrite, FileShare.None, 81920,
                FileOptions.Asynchronous | FileOptions.DeleteOnClose);
            await file.CopyToAsync(temp, ct);
            temp.Position = 0;

            var asset = await s.UploadAsync(new UploadInput(temp, file.FileName, contentType, form["altText"].ToString()), ct);
            return Results.Created($"/api/admin/media/{asset.Id}", asset);
        });

        media.MapPatch("/{id:guid}", (Guid id, UpdateMediaRequest r, MediaService s, CancellationToken ct) => s.UpdateAsync(id, r, ct));

        media.MapDelete("/{id:guid}", async (Guid id, MediaService s, CancellationToken ct) =>
        {
            await s.DeleteAsync(id, ct);
            return Results.NoContent();
        });

        media.MapGet("/{id:guid}/references", (Guid id, MediaService s, CancellationToken ct) => s.GetReferencesAsync(id, ct));
    }

    private static IResult TooLarge(long max) => ApiErrors.Problem(StatusCodes.Status413PayloadTooLarge, "payload_too_large",
        $"The file exceeds the maximum upload size of {max.ToString("N0", CultureInfo.InvariantCulture)} bytes.",
        new Dictionary<string, object?> { ["maxUploadBytes"] = max });

    private static void MapSettings(RouteGroupBuilder settings)
    {
        settings.MapGet("/", (SettingsService s, CancellationToken ct) => s.GetAsync(ct));
        settings.MapPut("/", (JsonElement body, SettingsService s, CancellationToken ct) => s.UpdateAsync(body, ct));
        settings.MapPost("/reset/{section}", (string section, SettingsService s, CancellationToken ct) => s.ResetSectionAsync(section, ct));
    }
}
