using System.Net;
using System.Threading.RateLimiting;
using CashewBlog.Api.Endpoints;
using CashewBlog.Api.Hosting;
using CashewBlog.Application;
using CashewBlog.Application.Abstractions;
using CashewBlog.Application.Common;
using CashewBlog.Application.Settings;
using CashewBlog.Infrastructure;
using CashewBlog.Infrastructure.Configuration;
using CashewBlog.Infrastructure.Jobs;
using CashewBlog.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.HttpOverrides;

var builder = WebApplication.CreateBuilder(args);
var runtime = RuntimeOptions.Resolve(builder.Configuration, builder.Environment);

// ------------------------------------------------------------------------- services

builder.Services.AddSingleton(runtime);
builder.Services.AddApplication();
builder.Services.AddInfrastructure(
    new RuntimePaths(runtime.DataDirectory, builder.Environment.ContentRootPath, runtime.DefaultStorageRoot),
    new MaintenanceOptions(runtime.BackgroundJobs, TimeSpan.FromMinutes(1), TimeSpan.FromHours(1)));

builder.Services.AddSingleton<IAppInfo, AppInfo>();
builder.Services.AddMemoryCache();
builder.Services.AddSingleton<PublicCache>();
builder.Services.AddSingleton<IPublicCache>(sp => sp.GetRequiredService<PublicCache>());
builder.Services.AddHttpClient();
builder.Services.AddSingleton<WebUpstreamProbe>();
builder.Services.AddSingleton<AdminEntrance>();
builder.Services.AddHttpForwarder();

builder.Services.ConfigureHttpJsonOptions(o => AppJson.Configure(o.SerializerOptions));
// Binding failures (malformed JSON, bad enum values) surface as BadHttpRequestException, which the
// exception handler turns into a descriptive 400 problem instead of an empty response.
builder.Services.Configure<RouteHandlerOptions>(o => o.ThrowOnBadRequest = true);
builder.Services.AddProblemDetails();
builder.Services.AddExceptionHandler<ApiExceptionHandler>();

builder.Services.Configure<ForwardedHeadersOptions>(o =>
{
    o.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto | ForwardedHeaders.XForwardedHost;
    // Walk the whole X-Forwarded-For chain (e.g. Cloudflare -> nginx -> app); every hop must be trusted.
    o.ForwardLimit = null;
    // Loopback is trusted by default; add operator-configured proxies (IPs or CIDR ranges).
    foreach (var entry in runtime.TrustedProxies)
    {
        if (entry.Contains('/') && System.Net.IPNetwork.TryParse(entry, out var network))
        {
            o.KnownIPNetworks.Add(network);
        }
        else if (IPAddress.TryParse(entry, out var address))
        {
            o.KnownProxies.Add(address);
        }
    }
});

builder.Services.AddDataProtection()
    .SetApplicationName("CashewBlog")
    .PersistKeysToFileSystem(new DirectoryInfo(Path.Combine(runtime.DataDirectory, "keys")));

builder.Services.AddAuthentication(CookieAuthenticationDefaults.AuthenticationScheme)
    .AddCookie(o =>
    {
        o.Cookie.Name = AdminAuthEndpoints.AuthCookieName;
        o.Cookie.HttpOnly = true;
        o.Cookie.SameSite = SameSiteMode.Lax;
        o.Cookie.SecurePolicy = CookieSecurePolicy.SameAsRequest;
        o.ExpireTimeSpan = TimeSpan.FromDays(14);
        o.SlidingExpiration = true;
        // APIs answer 401/403 instead of redirecting to a login page.
        o.Events.OnRedirectToLogin = ctx => ApiErrors.WriteAsync(ctx.HttpContext, 401, "unauthorized", "Authentication required.");
        o.Events.OnRedirectToAccessDenied = ctx => ApiErrors.WriteAsync(ctx.HttpContext, 403, "forbidden", "Access denied.");
        // Sessions issued before a password change are rejected.
        o.Events.OnValidatePrincipal = ctx =>
        {
            var config = ctx.HttpContext.RequestServices.GetRequiredService<IConfigStore>();
            var stamp = ctx.Principal?.FindFirst(AdminAuthEndpoints.PasswordStampClaim)?.Value;
            if (!config.IsInitialized || stamp != AdminAuthEndpoints.PasswordStamp(config))
            {
                ctx.RejectPrincipal();
            }

            return Task.CompletedTask;
        };
    });
builder.Services.AddAuthorization();

builder.Services.AddAntiforgery(o =>
{
    o.HeaderName = Csrf.HeaderName;
    o.Cookie.Name = Csrf.CookieName;
    o.Cookie.HttpOnly = true;
    o.Cookie.SameSite = SameSiteMode.Strict;
    o.Cookie.SecurePolicy = CookieSecurePolicy.SameAsRequest;
});

builder.Services.AddRateLimiter(o =>
{
    o.AddPolicy(AdminAuthEndpoints.LoginRateLimitPolicy, ctx => RateLimitPartition.GetFixedWindowLimiter(
        ctx.Connection.RemoteIpAddress?.ToString() ?? "unknown",
        _ => new FixedWindowRateLimiterOptions { PermitLimit = runtime.LoginPermitsPerMinute, Window = TimeSpan.FromMinutes(1), QueueLimit = 0 }));

    // Coarse per-IP ceiling for the public API. Loopback (Astro SSR) and the signed-in admin are exempt.
    o.GlobalLimiter = PartitionedRateLimiter.Create<HttpContext, string>(ctx =>
        runtime.ApiPermitsPerMinute == 0
        || !ctx.Request.Path.StartsWithSegments("/api")
        || ctx.Connection.RemoteIpAddress is not { } ip || IPAddress.IsLoopback(ip)
        || ctx.User.Identity?.IsAuthenticated == true
            ? RateLimitPartition.GetNoLimiter("exempt")
            : RateLimitPartition.GetFixedWindowLimiter(ip.ToString(),
                _ => new FixedWindowRateLimiterOptions { PermitLimit = runtime.ApiPermitsPerMinute, Window = TimeSpan.FromMinutes(1), QueueLimit = 0 }));

    o.OnRejected = async (ctx, ct) =>
    {
        await ctx.HttpContext.RequestServices.GetRequiredService<ISecurityAlertRecorder>().RecordAsync(
            "RateLimitExceeded", "Warning",
            ctx.HttpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            ctx.HttpContext.Request.Path,
            "请求速率超过限制。", ct);
        ctx.HttpContext.Response.Headers.RetryAfter = "60";
        await ApiErrors.WriteAsync(ctx.HttpContext, StatusCodes.Status429TooManyRequests, "rate_limited", "Too many requests. Try again in a minute.");
    };
});

var app = builder.Build();

// ------------------------------------------------------------------ startup checks

var configStore = app.Services.GetRequiredService<IConfigStore>();
if (configStore.IsInitialized)
{
    try
    {
        await MigrationRunner.MigrateAsync(configStore.ConnectionString!, app.Logger);
    }
    catch (Exception ex)
    {
        app.Logger.LogCritical(ex, "Database migration failed. Check Database settings in {Path} and that PostgreSQL is reachable.",
            Path.Combine(configStore.DataDirectory, JsonConfigStore.FileName));
        throw;
    }
}
else
{
    app.Logger.LogWarning("CashewBlog is not configured yet; open /setup to run the first-time setup");
}

// ----------------------------------------------------------------------- pipeline

app.UseForwardedHeaders();
app.UseExceptionHandler();
app.UseMiddleware<SecurityMiddleware>();
app.UseMiddleware<SetupGateMiddleware>();
app.UseMiddleware<AdminEntranceMiddleware>(); // before routing: it may hand hidden admin pages to the web proxy
app.UseAdminStaticFiles(); // before routing: static files are only served when no endpoint matched
app.UseRouting();
app.UseAuthentication();
app.UseAuthorization();
app.UseRateLimiter();
app.UseBadGatewayPage();

// ---------------------------------------------------------------------- endpoints

app.MapHealthEndpoints(runtime);
app.MapSetupEndpoints();
app.MapPublicEndpoints();

var admin = app.MapGroup("/api/admin").AddEndpointFilter<CsrfFilter>();
admin.MapAdminAuthEndpoints();
var secured = admin.MapGroup("").RequireAuthorization();
secured.MapAdminAccountEndpoints();
secured.MapAdminContentEndpoints();
secured.MapAdminSystemEndpoints();
secured.MapSecurityAlertEndpoints();

app.MapApiFallback();
app.MapUploads();
app.MapAdminSpa();
app.MapWebProxy(runtime.WebUpstream);

app.Run();

/// <summary>Entry point; public for WebApplicationFactory in integration tests.</summary>
public partial class Program;
