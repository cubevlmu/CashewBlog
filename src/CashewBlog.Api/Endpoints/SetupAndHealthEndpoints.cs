using CashewBlog.Api.Hosting;
using CashewBlog.Application.Abstractions;
using CashewBlog.Application.Admin;
using CashewBlog.Application.Setup;

namespace CashewBlog.Api.Endpoints;

public static class SetupAndHealthEndpoints
{
    /// <summary>First-run setup API. The setup gate returns 404 for everything but status once initialized.</summary>
    public static void MapSetupEndpoints(this IEndpointRouteBuilder app)
    {
        var setup = app.MapGroup("/api/setup").WithTags("Setup");
        setup.MapGet("/status", (ISetupService s) => s.GetStatus());
        setup.MapPost("/database/test", (DatabaseTestRequest request, ISetupService s, CancellationToken ct) => s.TestDatabaseAsync(request, ct));
        setup.MapPost("/initialize", (InitializeRequest request, HttpContext context, ISetupService s, CancellationToken ct) =>
            s.InitializeAsync(request, context.Connection.RemoteIpAddress?.ToString(), ct));
    }

    public static void MapHealthEndpoints(this IEndpointRouteBuilder app, RuntimeOptions options)
    {
        app.MapGet("/health/live", () => Results.Ok(new { status = "live" })).ExcludeFromDescription();

        // Ready = initialized + database reachable (+ Astro reachable unless disabled).
        // Before setup it reports 200 "setup_required" so orchestrators don't restart-loop the wizard.
        app.MapGet("/health/ready", async (IConfigStore config, IServiceProvider services, WebUpstreamProbe web, CancellationToken ct) =>
        {
            if (!config.IsInitialized)
            {
                return Results.Ok(new { status = "setup_required" });
            }

            using var scope = services.CreateScope();
            var db = await scope.ServiceProvider.GetRequiredService<ISystemInfoService>().CheckDatabaseAsync(ct);
            var (webOk, webDetail) = options.ReadyCheckWeb ? await web.CheckAsync(ct) : (true, "not checked");
            var ready = db.Healthy && webOk;
            var body = new { status = ready ? "ready" : "unavailable", database = db.Healthy, web = webOk, webDetail };
            return ready ? Results.Ok(body) : Results.Json(body, statusCode: StatusCodes.Status503ServiceUnavailable);
        }).ExcludeFromDescription();
    }
}

/// <summary>Checks that the Astro SSR upstream answers HTTP.</summary>
public sealed class WebUpstreamProbe(IHttpClientFactory clients, RuntimeOptions options)
{
    public async Task<(bool Ok, string Detail)> CheckAsync(CancellationToken ct)
    {
        try
        {
            using var client = clients.CreateClient(nameof(WebUpstreamProbe));
            client.Timeout = TimeSpan.FromSeconds(2);
            using var response = await client.GetAsync(options.WebUpstream + "/", HttpCompletionOption.ResponseHeadersRead, ct);
            var ok = (int)response.StatusCode < 500;
            return (ok, $"{options.WebUpstream} → {(int)response.StatusCode}");
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException)
        {
            return (false, $"{options.WebUpstream} unreachable");
        }
    }
}
