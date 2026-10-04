using CashewBlog.Application.Abstractions;

namespace CashewBlog.Api.Hosting;

/// <summary>
/// Before setup: only the setup UI/API, admin static assets and health checks are served;
/// other API calls get 503 <c>setup_required</c> and other pages redirect to /setup.
/// After setup: setup endpoints (except status) return 404 and /setup redirects to the home page.
/// </summary>
public sealed class SetupGateMiddleware(RequestDelegate next, IConfigStore config)
{
    public async Task InvokeAsync(HttpContext context)
    {
        var path = context.Request.Path;

        if (config.IsInitialized)
        {
            if (path.StartsWithSegments("/api/setup") && !path.StartsWithSegments("/api/setup/status"))
            {
                await ApiErrors.WriteAsync(context, StatusCodes.Status404NotFound, "not_found", "Setup has already been completed.");
                return;
            }

            // To the home page, not /admin: the admin address must not be revealed.
            if (path.Equals("/setup", StringComparison.OrdinalIgnoreCase) || path.StartsWithSegments("/setup"))
            {
                context.Response.Redirect("/");
                return;
            }

            await next(context);
            return;
        }

        if (IsAllowedDuringSetup(path))
        {
            await next(context);
            return;
        }

        if (path.StartsWithSegments("/api") || !HttpMethods.IsGet(context.Request.Method) && !HttpMethods.IsHead(context.Request.Method))
        {
            await ApiErrors.WriteAsync(context, StatusCodes.Status503ServiceUnavailable, "setup_required", "CashewBlog has not been set up yet.");
            return;
        }

        context.Response.Redirect("/setup");
    }

    private static bool IsAllowedDuringSetup(PathString path) =>
        path.Equals("/browser-cache-worker.js", StringComparison.Ordinal)
        || path.StartsWithSegments("/api/setup")
        || path.StartsWithSegments("/setup")
        || path.StartsWithSegments("/health")
        || path.StartsWithSegments("/admin/assets")
        // Other static files emitted by the admin build (favicon, fonts, ...).
        || path.StartsWithSegments("/admin") && Path.HasExtension(path.Value);
}
