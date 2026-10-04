using System.Net;
using CashewBlog.Application.Abstractions;

namespace CashewBlog.Api.Hosting;

/// <summary>
/// Gateway-wide hardening: baseline security headers on every response, and a cheap bare 404 for
/// well-known exploit probes (dotfiles, PHP/WordPress/admin tools) so they never reach Astro SSR.
/// The admin SPA adds its own Content-Security-Policy (<see cref="AdminCsp"/>).
/// </summary>
public sealed class SecurityMiddleware(RequestDelegate next, IConfigStore config, ISecurityAlertRecorder alerts)
{
    private static readonly string[] ProbePrefixes =
    [
        "/wp-admin", "/wp-content", "/wp-includes", "/wp-login", "/wp-json", "/xmlrpc", "/phpmyadmin", "/pma",
        "/cgi-bin", "/vendor/phpunit", "/actuator", "/server-status", "/boaform", "/hnap1",
    ];

    private static readonly HashSet<string> ProbeExtensions = new(StringComparer.OrdinalIgnoreCase)
    {
        ".php", ".asp", ".aspx", ".jsp", ".cgi", ".env", ".ini", ".sql", ".bak", ".old", ".swp", ".git", ".htaccess", ".htpasswd",
    };

    public async Task InvokeAsync(HttpContext context)
    {
        var path = context.Request.Path;
        if (IsProbe(path))
        {
            if (config.IsInitialized)
            {
                await alerts.RecordAsync("RouteProbe", "Warning", context.Connection.RemoteIpAddress?.ToString() ?? "unknown",
                    path.Value ?? "/", "检测到常见管理后台或敏感文件探测。", context.RequestAborted);
            }
            context.Response.StatusCode = StatusCodes.Status404NotFound;
            context.Response.Headers.CacheControl = "no-store";
            return;
        }

        var headers = context.Response.Headers;
        if (path.StartsWithSegments("/api/admin") || path.StartsWithSegments("/api/setup"))
            headers.CacheControl = "private, no-store";
        headers.XContentTypeOptions = "nosniff";
        headers.XFrameOptions = "SAMEORIGIN";
        headers["Referrer-Policy"] = "strict-origin-when-cross-origin";
        headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()";
        headers["Cross-Origin-Opener-Policy"] = "same-origin";
        if (context.Request.IsHttps && !IsLoopback(context))
        {
            headers.StrictTransportSecurity = "max-age=31536000";
        }

        await next(context);
        if (config.IsInitialized && context.Response.StatusCode is StatusCodes.Status413RequestEntityTooLarge or StatusCodes.Status415UnsupportedMediaType)
        {
            var category = context.Response.StatusCode == StatusCodes.Status413RequestEntityTooLarge
                ? "OversizedRequest"
                : "InvalidContentType";
            await alerts.RecordAsync(category, "Warning", context.Connection.RemoteIpAddress?.ToString() ?? "unknown",
                path.Value ?? "/", category == "OversizedRequest" ? "请求体超过服务器限制。" : "请求使用了不支持的内容类型。", context.RequestAborted);
        }
    }

    /// <summary>Probe paths. /uploads is exempt: its stored names are generated and may carry any extension.</summary>
    public static bool IsProbe(PathString path)
    {
        var value = path.Value;
        if (string.IsNullOrEmpty(value) || value == "/" || path.StartsWithSegments("/uploads"))
        {
            return false;
        }

        // Dot-segments (/.env, /.git/config, /.aws/credentials); /.well-known is legitimate.
        if (value.Contains("/.", StringComparison.Ordinal) && !path.StartsWithSegments("/.well-known"))
        {
            return true;
        }

        return ProbePrefixes.Any(prefix => path.StartsWithSegments(prefix, StringComparison.OrdinalIgnoreCase))
            || ProbeExtensions.Contains(Path.GetExtension(value));
    }

    private static bool IsLoopback(HttpContext context) =>
        context.Connection.RemoteIpAddress is { } ip && IPAddress.IsLoopback(ip);
}

/// <summary>Content-Security-Policy for the admin SPA and setup wizard (sent with index.html).</summary>
public static class AdminCsp
{
    public const string Value =
        "default-src 'self'; "
        + "script-src 'self' https://challenges.cloudflare.com; "
        + "frame-src 'self' https://challenges.cloudflare.com; "
        + "connect-src 'self' https://v1.hitokoto.cn https://challenges.cloudflare.com; "
        + "img-src 'self' data: blob: https:; "
        + "media-src 'self' blob:; "
        + "style-src 'self' 'unsafe-inline'; "
        + "font-src 'self' data:; "
        + "worker-src 'self' blob:; "
        + "object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'self'";
}
