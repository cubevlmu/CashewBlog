using CashewBlog.Application.Abstractions;
using CashewBlog.Domain.Rules;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.DataProtection;

namespace CashewBlog.Api.Hosting;

/// <summary>
/// Entrance cookie: proof that the browser opened the configured login entrance. It is HttpOnly,
/// scoped to /api/admin, bound to the current entrance and valid for 12 hours.
/// </summary>
public sealed class AdminEntrance(IConfigStore config, IDataProtectionProvider protection)
{
    public const string CookieName = "cashewblog_entrance";
    private static readonly TimeSpan CookieLifetime = TimeSpan.FromHours(12);

    private readonly ITimeLimitedDataProtector _protector =
        protection.CreateProtector("CashewBlog.AdminEntrance").ToTimeLimitedDataProtector();

    public string Path => config.Current?.Admin.EffectiveLoginPath ?? LoginPathRules.Default;

    public bool IsHidden => Path != LoginPathRules.Default;

    public void Issue(HttpContext context) =>
        context.Response.Cookies.Append(CookieName, _protector.Protect(Path, CookieLifetime), new CookieOptions
        {
            HttpOnly = true,
            SameSite = SameSiteMode.Strict,
            Secure = context.Request.IsHttps,
            Path = "/api/admin",
            IsEssential = true,
        });

    public bool IsValid(HttpContext context)
    {
        if (!config.IsInitialized || !context.Request.Cookies.TryGetValue(CookieName, out var value) || string.IsNullOrEmpty(value))
        {
            return false;
        }

        try
        {
            return _protector.Unprotect(value) == Path;
        }
        catch (System.Security.Cryptography.CryptographicException)
        {
            return false; // expired, tampered or issued for another key ring
        }
    }
}

/// <summary>
/// Hides the admin behind the login entrance (<c>Admin.LoginPath</c>):
/// <list type="bullet">
/// <item>GET on the entrance serves the admin SPA and issues the entrance cookie; the login API
/// answers 404 without it, so skipping the entrance leaves nothing to brute-force.</item>
/// <item>When the entrance is not the default <c>/admin/login</c>, anonymous admin page requests go
/// to the public site's 404 page, so the admin cannot be found by guessing.</item>
/// </list>
/// Runs before routing so that it can still hand /admin pages to the web proxy.
/// </summary>
public sealed class AdminEntranceMiddleware(RequestDelegate next, IConfigStore config, AdminEntrance entrance)
{
    /// <summary>The SPA route that renders the login view; every admin route serves the same index.</summary>
    private const string SpaLoginRoute = "/admin/login";

    /// <summary>Matched only by the web proxy, which renders the public 404 page for it.</summary>
    private const string HiddenRewrite = "/__cashewblog_admin_hidden";

    public async Task InvokeAsync(HttpContext context)
    {
        if (!config.IsInitialized || !(HttpMethods.IsGet(context.Request.Method) || HttpMethods.IsHead(context.Request.Method)))
        {
            await next(context);
            return;
        }

        var path = context.Request.Path;
        if (string.Equals(path.Value?.TrimEnd('/'), entrance.Path, StringComparison.OrdinalIgnoreCase))
        {
            if (await IsSignedInAsync(context))
            {
                context.Response.Redirect("/admin");
                return;
            }

            entrance.Issue(context);
            context.Response.Headers.CacheControl = "no-store";
            context.Request.Path = SpaLoginRoute;
        }
        else if (entrance.IsHidden && IsAdminPage(path) && !await IsSignedInAsync(context))
        {
            context.Request.Path = HiddenRewrite;
        }

        await next(context);
    }

    /// <summary>Admin HTML routes; hashed assets and other static files stay public for the login page.</summary>
    private static bool IsAdminPage(PathString path) =>
        path.StartsWithSegments("/admin")
        && !path.StartsWithSegments("/admin/assets")
        && !System.IO.Path.HasExtension(path.Value);

    private static async Task<bool> IsSignedInAsync(HttpContext context) =>
        (await context.AuthenticateAsync(CookieAuthenticationDefaults.AuthenticationScheme)).Succeeded;
}
