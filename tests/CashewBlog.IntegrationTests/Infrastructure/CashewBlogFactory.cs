using System.Net.Http.Json;
using System.Text.Json;
using CashewBlog.Application.Common;
using CashewBlog.Application.Setup;
using CashewBlog.Infrastructure.Security;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Logging;

namespace CashewBlog.IntegrationTests.Infrastructure;

/// <summary>
/// Hosts the real application against a fresh database. By default a config.json is written
/// before startup (initialized instance); <see cref="SetupModeFactory"/> starts in setup mode.
/// </summary>
public class CashewBlogFactory : WebApplicationFactory<Program>, IAsyncLifetime
{
    public const string AdminPassword = "test-password-123";

    private readonly string _root = Path.Combine(Path.GetTempPath(), "cashewblog-it-" + Guid.NewGuid().ToString("N")[..12]);

    protected virtual bool Initialized => true;

    public TestDatabase Database { get; private set; } = null!;
    public string DataDirectory => Path.Combine(_root, "data");
    public string UploadsDirectory => Path.Combine(_root, "uploads");

    public static JsonSerializerOptions Json => AppJson.Options;

    public async ValueTask InitializeAsync()
    {
        Directory.CreateDirectory(DataDirectory);
        Directory.CreateDirectory(UploadsDirectory);
        Database = await TestDatabase.CreateAsync();

        if (Initialized)
        {
            var config = new AppConfig
            {
                Admin = new AdminConfig { PasswordHash = new Argon2PasswordHasher().Hash(AdminPassword) },
                Database = Database.ToConfig(),
                Storage = new StorageConfig { Root = UploadsDirectory, MaxUploadBytes = 5 * 1024 * 1024 },
            };
            await File.WriteAllTextAsync(Path.Combine(DataDirectory, "config.json"), JsonSerializer.Serialize(config));
        }
    }

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Testing");
        builder.ConfigureLogging(logging => logging.AddProvider(new ServerErrorLog()));
        builder.UseSetting("CashewBlog:DataDir", DataDirectory);
        builder.UseSetting("CashewBlog:UploadsDir", UploadsDirectory);
        builder.UseSetting("CashewBlog:BackgroundJobs", "false");
        builder.UseSetting("CashewBlog:LoginRateLimit", "1000");
        builder.UseSetting("CashewBlog:ReadyCheckWeb", "false");
        // Nothing listens here: proxied requests produce the 502 page.
        builder.UseSetting("CashewBlog:WebUpstream", "http://127.0.0.1:9");
    }

    public HttpClient CreateBrowserClient() =>
        CreateClient(new WebApplicationFactoryClientOptions { AllowAutoRedirect = false, HandleCookies = true });

    /// <summary>Client with cookies, a CSRF header and (optionally) an authenticated admin session.</summary>
    public async Task<HttpClient> CreateAdminClientAsync(bool login = true)
    {
        var client = CreateBrowserClient();
        await RefreshCsrfAsync(client);
        if (login)
        {
            var response = await client.PostAsJsonAsync("/api/admin/login", new { password = AdminPassword });
            response.EnsureSuccessStatusCode();
            await RefreshCsrfAsync(client); // tokens are bound to the signed-in identity
        }

        return client;
    }

    public static async Task RefreshCsrfAsync(HttpClient client)
    {
        var csrf = await client.GetFromJsonAsync<JsonElement>("/api/admin/csrf");
        client.DefaultRequestHeaders.Remove("X-XSRF-TOKEN");
        client.DefaultRequestHeaders.Add("X-XSRF-TOKEN", csrf.GetProperty("token").GetString());
    }

    public override async ValueTask DisposeAsync()
    {
        await base.DisposeAsync();
        await Database.DisposeAsync();
        try
        {
            Directory.Delete(_root, recursive: true);
        }
        catch (IOException)
        {
            // Best effort: files may still be locked briefly on Windows.
        }

        GC.SuppressFinalize(this);
    }
}

public sealed class SetupModeFactory : CashewBlogFactory
{
    protected override bool Initialized => false;
}
