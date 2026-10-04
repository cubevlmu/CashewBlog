namespace CashewBlog.Api.Hosting;

/// <summary>
/// Host-level options. Each value can come from configuration (<c>CashewBlog:*</c>, e.g. appsettings
/// or <c>--CashewBlog:DataDir=...</c>) or from the documented environment variable.
/// </summary>
public sealed record RuntimeOptions(
    string DataDirectory,
    string DefaultStorageRoot,
    string WebUpstream,
    IReadOnlyList<string> TrustedProxies,
    int LoginPermitsPerMinute,
    int ApiPermitsPerMinute,
    bool BackgroundJobs,
    bool ReadyCheckWeb)
{
    public static RuntimeOptions Resolve(IConfiguration configuration, IHostEnvironment environment)
    {
        string? Get(string key, string envName) =>
            NullIfEmpty(configuration[$"CashewBlog:{key}"]) ?? NullIfEmpty(Environment.GetEnvironmentVariable(envName));

        var inContainer = string.Equals(Environment.GetEnvironmentVariable("DOTNET_RUNNING_IN_CONTAINER"), "true", StringComparison.OrdinalIgnoreCase);
        var contentRoot = environment.ContentRootPath;

        var dataDir = Get("DataDir", "CASHEWBLOG_DATA_DIR") ?? (inContainer ? "/data" : "data");
        var uploadsDir = Get("UploadsDir", "CASHEWBLOG_UPLOADS_DIR") ?? (inContainer ? "/uploads" : "uploads");
        var proxies = (Get("TrustedProxies", "CASHEWBLOG_TRUSTED_PROXIES") ?? "")
            .Split([',', ';', ' '], StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

        return new RuntimeOptions(
            Path.GetFullPath(dataDir, contentRoot),
            Path.GetFullPath(uploadsDir, contentRoot),
            (Get("WebUpstream", "CASHEWBLOG_WEB_UPSTREAM") ?? "http://127.0.0.1:4321").TrimEnd('/'),
            proxies,
            int.TryParse(Get("LoginRateLimit", "CASHEWBLOG_LOGIN_RATE_LIMIT"), out var permits) && permits > 0 ? permits : 5,
            // 0 disables the public API limiter.
            int.TryParse(Get("ApiRateLimit", "CASHEWBLOG_API_RATE_LIMIT"), out var api) && api >= 0 ? api : 300,
            !bool.TryParse(Get("BackgroundJobs", "CASHEWBLOG_BACKGROUND_JOBS"), out var jobs) || jobs,
            !bool.TryParse(Get("ReadyCheckWeb", "CASHEWBLOG_READY_CHECK_WEB"), out var web) || web);
    }

    private static string? NullIfEmpty(string? value) => string.IsNullOrWhiteSpace(value) ? null : value;
}
