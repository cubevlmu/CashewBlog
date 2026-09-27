using System.Diagnostics;
using System.Net;
using CashewBlog.Application.Abstractions;
using Microsoft.AspNetCore.StaticFiles;
using Microsoft.Extensions.FileProviders;
using Microsoft.Net.Http.Headers;
using Yarp.ReverseProxy.Forwarder;

namespace CashewBlog.Api.Hosting;

/// <summary>
/// Single public entry point: admin SPA static files + fallback, /uploads, and a reverse proxy
/// that sends everything else to the Astro SSR server.
/// </summary>
public static class Gateway
{
    private static readonly FileExtensionContentTypeProvider ContentTypes = new();

    /// <summary>Types served inline from /uploads; everything else is sent as an attachment.</summary>
    private static readonly HashSet<string> InlineTypes = new(StringComparer.OrdinalIgnoreCase)
    {
        "image/png", "image/jpeg", "image/gif", "image/webp", "image/avif", "image/bmp", "image/x-icon",
        "image/vnd.microsoft.icon", "image/tiff", "video/mp4", "video/webm", "video/ogg", "audio/mpeg",
        "audio/ogg", "audio/wav", "audio/webm", "audio/aac", "audio/flac", "application/pdf",
    };

    public static string AdminRoot(IWebHostEnvironment env) => Path.Combine(env.ContentRootPath, "wwwroot", "admin");

    /// <summary>Serves built admin assets under /admin (no-op when the admin build is absent).</summary>
    public static void UseAdminStaticFiles(this WebApplication app)
    {
        var root = AdminRoot(app.Environment);
        if (!Directory.Exists(root))
        {
            app.Logger.LogInformation("Admin UI build not found at {Path}; /admin will return 404 until it is built", root);
            return;
        }

        app.UseStaticFiles(new StaticFileOptions
        {
            FileProvider = new PhysicalFileProvider(root),
            RequestPath = "/admin",
            OnPrepareResponse = ctx =>
            {
                // Vite emits content-hashed file names under /admin/assets.
                ctx.Context.Response.Headers.CacheControl = ctx.Context.Request.Path.StartsWithSegments("/admin/assets")
                    ? "public, max-age=31536000, immutable"
                    : "no-cache";
            },
        });
    }

    public static void MapAdminSpa(this WebApplication app)
    {
        var index = Path.Combine(AdminRoot(app.Environment), "index.html");

        IResult ServeIndex(HttpContext context)
        {
            var path = context.Request.Path;
            // Missing hashed assets must 404 rather than return HTML.
            if (path.StartsWithSegments("/admin/assets") || Path.HasExtension(path.Value) && !path.Value!.EndsWith(".html", StringComparison.OrdinalIgnoreCase))
            {
                return Results.NotFound();
            }

            if (!File.Exists(index))
            {
                return Results.Text("CashewBlog admin UI is not built (expected wwwroot/admin/index.html).", "text/plain", statusCode: 404);
            }

            context.Response.Headers.CacheControl = "no-cache";
            return Results.File(index, "text/html; charset=utf-8");
        }

        app.MapMethods("/admin", ["GET", "HEAD"], ServeIndex).ExcludeFromDescription();
        app.MapMethods("/admin/{**path}", ["GET", "HEAD"], ServeIndex).ExcludeFromDescription();
        app.MapMethods("/setup", ["GET", "HEAD"], ServeIndex).ExcludeFromDescription();
        app.MapMethods("/setup/{**path}", ["GET", "HEAD"], ServeIndex).ExcludeFromDescription();
    }

    /// <summary>
    /// /uploads/** from the storage root, with path normalization, nosniff, long-lived caching
    /// (names are unique and immutable) and attachment disposition for non-media types.
    /// </summary>
    public static void MapUploads(this WebApplication app)
    {
        app.MapMethods("/uploads/{**path}", ["GET", "HEAD"], (string? path, HttpContext context, IMediaStorage storage) =>
        {
            var full = path is null ? null : storage.ResolveExisting(path);
            if (full is null)
            {
                return Results.NotFound();
            }

            if (!ContentTypes.TryGetContentType(full, out var contentType))
            {
                contentType = "application/octet-stream";
            }

            var headers = context.Response.Headers;
            headers.XContentTypeOptions = "nosniff";
            headers.CacheControl = "public, max-age=31536000, immutable";
            // Uploaded HTML/SVG must never run as same-origin documents (browser PDF viewers break under sandbox).
            if (contentType != "application/pdf")
            {
                headers.ContentSecurityPolicy = "default-src 'none'; img-src 'self'; media-src 'self'; style-src 'unsafe-inline'; sandbox";
            }

            var info = new FileInfo(full);
            var etag = new EntityTagHeaderValue($"\"{info.Length:x}-{info.LastWriteTimeUtc.Ticks:x}\"");
            var inline = InlineTypes.Contains(contentType);
            return Results.File(full, contentType,
                fileDownloadName: inline ? null : Path.GetFileName(full),
                lastModified: info.LastWriteTimeUtc,
                entityTag: etag,
                enableRangeProcessing: true);
        }).ExcludeFromDescription();
    }

    /// <summary>Forwards all remaining requests to the Astro SSR server.</summary>
    public static void MapWebProxy(this WebApplication app, string upstream)
    {
        var client = new HttpMessageInvoker(new SocketsHttpHandler
        {
            UseProxy = false,
            AllowAutoRedirect = false,
            AutomaticDecompression = DecompressionMethods.None,
            UseCookies = false,
            EnableMultipleHttp2Connections = true,
            ActivityHeadersPropagator = new ReverseProxyPropagator(DistributedContextPropagator.Current),
            ConnectTimeout = TimeSpan.FromSeconds(5),
        });

        app.MapForwarder("/{**catch-all}", upstream, ForwarderRequestConfig.Empty, new WebTransformer(), client)
            .ExcludeFromDescription();
    }

    /// <summary>Replaces YARP's empty 502 with a small HTML page when Astro is unreachable.</summary>
    public static void UseBadGatewayPage(this WebApplication app)
    {
        app.Use(async (context, next) =>
        {
            await next(context);
            var error = context.GetForwarderErrorFeature();
            if (error is null || context.Response.HasStarted)
            {
                return;
            }

            app.Logger.LogWarning(error.Exception, "Web upstream error {Error} for {Path}", error.Error, context.Request.Path);
            context.Response.Clear();
            context.Response.StatusCode = StatusCodes.Status502BadGateway;
            context.Response.ContentType = "text/html; charset=utf-8";
            context.Response.Headers.CacheControl = "no-store";
            await context.Response.WriteAsync("""
                <!doctype html>
                <html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
                <title>502 Bad Gateway</title>
                <style>body{font-family:system-ui,sans-serif;display:grid;place-items:center;min-height:100vh;margin:0;background:#faf7fb;color:#1d1b20}
                main{text-align:center;padding:2rem}h1{font-size:3rem;margin:0}p{opacity:.75}</style></head>
                <body><main><h1>502</h1><p>The site is temporarily unavailable. Please try again in a moment.</p></main></body></html>
                """);
        });
    }

    /// <summary>
    /// Preserves the original Host and sends fresh X-Forwarded-* values (the forwarded-headers
    /// middleware has already resolved the real client IP and scheme from trusted proxies).
    /// </summary>
    private sealed class WebTransformer : HttpTransformer
    {
        public override async ValueTask TransformRequestAsync(HttpContext httpContext, HttpRequestMessage proxyRequest, string destinationPrefix, CancellationToken cancellationToken)
        {
            await base.TransformRequestAsync(httpContext, proxyRequest, destinationPrefix, cancellationToken);

            proxyRequest.Headers.Host = httpContext.Request.Host.Value;
            proxyRequest.Headers.Remove("X-Forwarded-For");
            proxyRequest.Headers.Remove("X-Forwarded-Proto");
            proxyRequest.Headers.Remove("X-Forwarded-Host");
            proxyRequest.Headers.Remove("Forwarded");

            if (httpContext.Connection.RemoteIpAddress is { } ip)
            {
                proxyRequest.Headers.TryAddWithoutValidation("X-Forwarded-For", ip.ToString());
            }

            proxyRequest.Headers.TryAddWithoutValidation("X-Forwarded-Proto", httpContext.Request.Scheme);
            proxyRequest.Headers.TryAddWithoutValidation("X-Forwarded-Host", httpContext.Request.Host.Value);
        }
    }
}
