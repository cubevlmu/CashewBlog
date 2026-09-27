using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using CashewBlog.IntegrationTests.Infrastructure;

namespace CashewBlog.IntegrationTests;

public class SetupFlowTests(SetupModeFactory factory) : IClassFixture<SetupModeFactory>
{
    [Fact]
    public async Task Complete_first_run_setup_without_restart()
    {
        var client = factory.CreateBrowserClient();
        var db = factory.Database.ToConfig();

        // 1. Setup required: status says so, APIs are gated, pages redirect to /setup.
        var status = await client.GetAsync<JsonElement>("/api/setup/status");
        Assert.True(status.GetProperty("setupRequired").GetBoolean());

        var gated = await client.GetAsync("/api/posts");
        await gated.AssertStatusAsync(HttpStatusCode.ServiceUnavailable);
        Assert.Equal("setup_required", (await gated.JsonAsync()).GetProperty("error").GetString());

        var page = await client.GetAsync("/posts/hello");
        Assert.Equal(HttpStatusCode.Redirect, page.StatusCode);
        Assert.Equal("/setup", page.Headers.Location?.OriginalString);

        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("/health/live")).StatusCode);
        var ready = await client.GetAsync<JsonElement>("/health/ready");
        Assert.Equal("setup_required", ready.GetProperty("status").GetString());

        // 2. Database test: missing database gives a clear error, the real one succeeds.
        var missing = await (await client.PostJsonAsync("/api/setup/database/test", new
        {
            host = db.Host, port = db.Port, database = "cashewblog_does_not_exist", username = db.Username, password = db.Password, sslMode = "Disable",
        })).ReadAsync<JsonElement>();
        Assert.False(missing.GetProperty("ok").GetBoolean());
        Assert.Equal("database_not_found", missing.GetProperty("code").GetString());

        var dbRequest = new { host = db.Host, port = db.Port, database = db.Database, username = db.Username, password = db.Password, sslMode = "Disable" };
        var ok = await (await client.PostJsonAsync("/api/setup/database/test", dbRequest)).ReadAsync<JsonElement>();
        Assert.True(ok.GetProperty("ok").GetBoolean(), ok.ToString());
        Assert.True(ok.GetProperty("trigramAvailable").GetBoolean());

        // 3. Validation errors are reported per field.
        var invalid = await client.PostJsonAsync("/api/setup/initialize", new { siteName = "", siteUrl = "nope", password = "short", database = dbRequest });
        await invalid.AssertStatusAsync(HttpStatusCode.BadRequest);
        var errors = (await invalid.JsonAsync()).GetProperty("errors");
        Assert.True(errors.TryGetProperty("siteName", out _));
        Assert.True(errors.TryGetProperty("siteUrl", out _));
        Assert.True(errors.TryGetProperty("password", out _));

        // 4. Initialize.
        var init = await client.PostJsonAsync("/api/setup/initialize", new
        {
            siteName = "Cashew 测试",
            siteUrl = "https://blog.example.com/",
            adminName = "Nut",
            timezone = "Asia/Shanghai",
            password = CashewBlogFactory.AdminPassword,
            database = dbRequest,
            storage = new { root = factory.UploadsDirectory, maxUploadBytes = 10 * 1024 * 1024 },
        });
        await init.AssertStatusAsync(HttpStatusCode.OK);
        Assert.True(File.Exists(Path.Combine(factory.DataDirectory, "config.json")));
        var configText = await File.ReadAllTextAsync(Path.Combine(factory.DataDirectory, "config.json"));
        Assert.Contains("$argon2id$", configText);
        Assert.DoesNotContain(CashewBlogFactory.AdminPassword, configText);

        // 5. Setup is now closed; the runtime uses the new database immediately.
        status = await client.GetAsync<JsonElement>("/api/setup/status");
        Assert.False(status.GetProperty("setupRequired").GetBoolean());
        await (await client.PostJsonAsync("/api/setup/initialize", new { })).AssertStatusAsync(HttpStatusCode.NotFound);
        await (await client.PostJsonAsync("/api/setup/database/test", dbRequest)).AssertStatusAsync(HttpStatusCode.NotFound);

        var bootstrap = await client.GetAsync<JsonElement>("/api/site/bootstrap");
        var settings = bootstrap.GetProperty("settings");
        Assert.Equal("Cashew 测试", settings.GetProperty("general").GetProperty("siteName").GetString());
        Assert.Equal("Nut", settings.GetProperty("profile").GetProperty("name").GetString());
        Assert.False(settings.TryGetProperty("dashboard", out _));

        // 6. Login with the new password works.
        var admin = await factory.CreateAdminClientAsync();
        var session = await admin.GetAsync<JsonElement>("/api/admin/session");
        Assert.True(session.GetProperty("authenticated").GetBoolean());
    }
}

public class SecurityTests(CashewBlogFactory factory) : IClassFixture<CashewBlogFactory>
{
    [Fact]
    public async Task Admin_api_requires_authentication_without_redirects()
    {
        var client = factory.CreateBrowserClient();
        var response = await client.GetAsync("/api/admin/posts");
        await response.AssertStatusAsync(HttpStatusCode.Unauthorized);
        Assert.Null(response.Headers.Location);
    }

    [Fact]
    public async Task Wrong_password_is_rejected()
    {
        var client = await factory.CreateAdminClientAsync(login: false);
        var response = await client.PostJsonAsync("/api/admin/login", new { password = "wrong-password" });
        await response.AssertStatusAsync(HttpStatusCode.Unauthorized);
        Assert.Equal("invalid_password", (await response.JsonAsync()).GetProperty("error").GetString());
    }

    [Fact]
    public async Task Writes_without_csrf_token_are_rejected()
    {
        var admin = await factory.CreateAdminClientAsync();
        admin.DefaultRequestHeaders.Remove("X-XSRF-TOKEN");

        var response = await admin.PostJsonAsync("/api/admin/posts", HttpExtensions.PostRequest("No CSRF"));
        await response.AssertStatusAsync(HttpStatusCode.BadRequest);
        Assert.Equal("csrf_invalid", (await response.JsonAsync()).GetProperty("error").GetString());

        // Login itself is protected too.
        var anonymous = factory.CreateBrowserClient();
        var login = await anonymous.PostAsJsonAsync("/api/admin/login", new { password = CashewBlogFactory.AdminPassword });
        await login.AssertStatusAsync(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task Session_cookie_is_http_only_and_lax()
    {
        var client = await factory.CreateAdminClientAsync(login: false);
        var response = await client.PostJsonAsync("/api/admin/login", new { password = CashewBlogFactory.AdminPassword });
        await response.AssertStatusAsync(HttpStatusCode.OK);

        var cookies = response.Headers.GetValues("Set-Cookie").ToList();
        var auth = cookies.Single(c => c.StartsWith("cashewblog_auth=", StringComparison.Ordinal));
        Assert.Contains("httponly", auth, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("samesite=lax", auth, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("expires=", auth, StringComparison.OrdinalIgnoreCase);
        Assert.Contains(cookies, c => c.StartsWith("XSRF-TOKEN=", StringComparison.Ordinal) && !c.Contains("httponly", StringComparison.OrdinalIgnoreCase));
    }

    [Fact]
    public async Task Unknown_api_routes_are_json_404_and_pages_go_to_the_web_upstream()
    {
        var client = factory.CreateBrowserClient();
        await (await client.GetAsync("/api/nope")).AssertStatusAsync(HttpStatusCode.NotFound);

        // No Astro server in tests: the gateway answers with its 502 page.
        var page = await client.GetAsync("/some/page");
        await page.AssertStatusAsync(HttpStatusCode.BadGateway);
        Assert.Contains("502", await page.Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task Setup_endpoints_are_closed_when_initialized()
    {
        var client = factory.CreateBrowserClient();
        await (await client.PostJsonAsync("/api/setup/initialize", new { })).AssertStatusAsync(HttpStatusCode.NotFound);
    }
}
