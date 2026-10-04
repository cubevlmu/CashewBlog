using System.Globalization;
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

        var reserved = await client.PostJsonAsync("/api/setup/initialize", new { siteName = "x", siteUrl = "https://x.test", adminName = "x", password = CashewBlogFactory.AdminPassword, database = dbRequest, security = new { loginPath = "/admin" } });
        await reserved.AssertStatusAsync(HttpStatusCode.BadRequest);
        Assert.True((await reserved.JsonAsync()).GetProperty("errors").TryGetProperty("security.loginPath", out _));

        // Turnstile keys must be proven with a solved challenge.
        var unproven = await client.PostJsonAsync("/api/setup/initialize", new
        {
            siteName = "x", siteUrl = "https://x.test", adminName = "x", password = CashewBlogFactory.AdminPassword, database = dbRequest,
            security = new { loginPath = CashewBlogFactory.EntrancePath, turnstileSiteKey = "site", turnstileSecretKey = "secret", turnstileToken = "wrong" },
        });
        await unproven.AssertStatusAsync(HttpStatusCode.BadRequest);
        Assert.True((await unproven.JsonAsync()).GetProperty("errors").TryGetProperty("security.turnstile", out _));
        Assert.True((await client.GetAsync<JsonElement>("/api/setup/status")).GetProperty("setupRequired").GetBoolean());

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
            security = new { loginPath = "/Cashew-Door/" },
        });
        await init.AssertStatusAsync(HttpStatusCode.OK);
        Assert.Equal(CashewBlogFactory.EntrancePath, (await init.JsonAsync()).GetProperty("redirectTo").GetString());
        Assert.True(File.Exists(Path.Combine(factory.DataDirectory, "config.json")));
        var configText = await File.ReadAllTextAsync(Path.Combine(factory.DataDirectory, "config.json"));
        Assert.Contains("$argon2id$", configText);
        Assert.DoesNotContain(CashewBlogFactory.AdminPassword, configText);

        // 5. Setup is now closed; the runtime uses the new database immediately.
        status = await client.GetAsync<JsonElement>("/api/setup/status");
        Assert.False(status.GetProperty("setupRequired").GetBoolean());
        await (await client.PostJsonAsync("/api/setup/initialize", new { })).AssertStatusAsync(HttpStatusCode.NotFound);
        await (await client.PostJsonAsync("/api/setup/database/test", dbRequest)).AssertStatusAsync(HttpStatusCode.NotFound);
        Assert.Equal("/", (await client.GetAsync("/setup")).Headers.Location?.OriginalString);

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
        await anonymous.GetAsync(CashewBlogFactory.EntrancePath);
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
    public async Task Login_requires_the_entrance_cookie()
    {
        var client = factory.CreateBrowserClient();
        await CashewBlogFactory.RefreshCsrfAsync(client);
        await (await client.PostJsonAsync("/api/admin/login", new { password = CashewBlogFactory.AdminPassword })).AssertStatusAsync(HttpStatusCode.NotFound);
        await (await client.GetAsync("/api/admin/login/options")).AssertStatusAsync(HttpStatusCode.NotFound);

        var entrance = await client.GetAsync(CashewBlogFactory.EntrancePath);
        var cookie = entrance.Headers.GetValues("Set-Cookie").Single(c => c.StartsWith("cashewblog_entrance=", StringComparison.Ordinal));
        Assert.Contains("httponly", cookie, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("samesite=strict", cookie, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("path=/api/admin", cookie, StringComparison.OrdinalIgnoreCase);

        var options = await client.GetAsync<JsonElement>("/api/admin/login/options");
        Assert.Equal(JsonValueKind.Null, options.GetProperty("turnstileSiteKey").ValueKind);
        await CashewBlogFactory.RefreshCsrfAsync(client);
        await (await client.PostJsonAsync("/api/admin/login", new { password = CashewBlogFactory.AdminPassword })).AssertStatusAsync(HttpStatusCode.OK);
    }

    [Fact]
    public async Task Hidden_admin_pages_are_not_served_to_anonymous_visitors()
    {
        // Anonymous /admin pages go to the public site (here the 502 page: no Astro runs in tests).
        var anonymous = factory.CreateBrowserClient();
        foreach (var path in new[] { "/admin", "/admin/login", "/admin/settings/security" })
        {
            await (await anonymous.GetAsync(path)).AssertStatusAsync(HttpStatusCode.BadGateway);
        }

        // The entrance is served by the admin SPA handler (the index, or 404 when the admin is not built), never cached.
        var entrance = await anonymous.GetAsync(CashewBlogFactory.EntrancePath + "/");
        Assert.NotEqual(HttpStatusCode.BadGateway, entrance.StatusCode);
        Assert.Equal("no-store", entrance.Headers.CacheControl?.ToString());
        if (entrance.IsSuccessStatusCode)
        {
            Assert.Contains("frame-ancestors 'self'", entrance.Headers.GetValues("Content-Security-Policy").Single());
        }

        // Signed in, admin routes are served and the entrance redirects into the admin.
        var admin = await factory.CreateAdminClientAsync();
        Assert.NotEqual(HttpStatusCode.BadGateway, (await admin.GetAsync("/admin/settings/security")).StatusCode);
        Assert.Equal("/admin", (await admin.GetAsync(CashewBlogFactory.EntrancePath)).Headers.Location?.OriginalString);
    }

    [Fact]
    public async Task Responses_carry_security_headers_and_probes_are_dropped()
    {
        var client = factory.CreateBrowserClient();
        var response = await client.GetAsync("/api/site/bootstrap");
        await response.AssertStatusAsync(HttpStatusCode.OK);
        Assert.Equal("nosniff", response.Headers.GetValues("X-Content-Type-Options").Single());
        Assert.Equal("SAMEORIGIN", response.Headers.GetValues("X-Frame-Options").Single());
        Assert.Equal("same-origin", response.Headers.GetValues("Cross-Origin-Opener-Policy").Single());
        Assert.True(response.Headers.Contains("Permissions-Policy"));
        Assert.False(response.Headers.Contains("Strict-Transport-Security")); // plain HTTP

        foreach (var probe in new[] { "/.env", "/.git/config", "/wp-login.php", "/wp-admin/setup.php", "/phpmyadmin/", "/index.php", "/backup.sql" })
        {
            var hit = await client.GetAsync(probe);
            Assert.Equal(HttpStatusCode.NotFound, hit.StatusCode);
            Assert.Empty(await hit.Content.ReadAsByteArrayAsync());
        }

        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("/health/live")).StatusCode);
    }

    [Fact]
    public async Task Oversized_passwords_are_rejected()
    {
        // Kestrel caps the body at 16 KiB (413); TestServer has no body limit, so the 256-character cap answers.
        var client = await factory.CreateAdminClientAsync(login: false);
        var response = await client.PostJsonAsync("/api/admin/login", new { password = new string('x', 20_000) });
        Assert.Contains(response.StatusCode, new[] { HttpStatusCode.RequestEntityTooLarge, HttpStatusCode.Unauthorized });
    }


    [Fact]
    public async Task Setup_endpoints_are_closed_when_initialized()
    {
        var client = factory.CreateBrowserClient();
        await (await client.PostJsonAsync("/api/setup/initialize", new { })).AssertStatusAsync(HttpStatusCode.NotFound);
    }
}

/// <summary>Own fixture: the lockout is per client address and would affect other tests.</summary>
public class LoginLockoutTests(CashewBlogFactory factory) : IClassFixture<CashewBlogFactory>
{
    [Fact]
    public async Task Repeated_failures_lock_out_the_address_even_for_the_right_password()
    {
        var client = await factory.CreateAdminClientAsync(login: false);
        for (var i = 1; i < 5; i++)
        {
            await (await client.PostJsonAsync("/api/admin/login", new { password = "wrong-password" })).AssertStatusAsync(HttpStatusCode.Unauthorized);
        }

        var fifth = await client.PostJsonAsync("/api/admin/login", new { password = "wrong-password" });
        await fifth.AssertStatusAsync(HttpStatusCode.TooManyRequests);
        Assert.Equal("login_locked", (await fifth.JsonAsync()).GetProperty("error").GetString());
        Assert.True(int.Parse(fifth.Headers.GetValues("Retry-After").Single(), CultureInfo.InvariantCulture) > 60);

        var locked = await client.PostJsonAsync("/api/admin/login", new { password = CashewBlogFactory.AdminPassword });
        await locked.AssertStatusAsync(HttpStatusCode.TooManyRequests);
    }
}

/// <summary>Own fixture: these tests change the login entrance and the Turnstile keys.</summary>
public class SecuritySettingsTests(CashewBlogFactory factory) : IClassFixture<CashewBlogFactory>
{
    private const string Password = CashewBlogFactory.AdminPassword;

    [Fact]
    public async Task Entrance_and_turnstile_can_be_changed_safely()
    {
        var admin = await factory.CreateAdminClientAsync();
        var settings = await admin.GetAsync<JsonElement>("/api/admin/security");
        Assert.Equal(CashewBlogFactory.EntrancePath, settings.GetProperty("loginPath").GetString());
        Assert.True(settings.GetProperty("loginPathHidden").GetBoolean());
        Assert.False(settings.GetProperty("hasTurnstileSecret").GetBoolean());

        // The current password is required, reserved paths are refused and new keys must be proven.
        var noPassword = await admin.PutJsonAsync("/api/admin/security", new { currentPassword = "nope", loginPath = "/new-door" });
        Assert.True((await noPassword.JsonAsync()).GetProperty("errors").TryGetProperty("currentPassword", out _));
        var reservedPath = await admin.PutJsonAsync("/api/admin/security", new { currentPassword = Password, loginPath = "/posts" });
        Assert.True((await reservedPath.JsonAsync()).GetProperty("errors").TryGetProperty("loginPath", out _));
        var unproven = await admin.PutJsonAsync("/api/admin/security", new
        {
            currentPassword = Password, loginPath = "/new-door", turnstileEnabled = true,
            turnstileSiteKey = "site", turnstileSecretKey = "secret", turnstileToken = "wrong",
        });
        Assert.True((await unproven.JsonAsync()).GetProperty("errors").TryGetProperty("turnstile", out _));

        var saved = await admin.PutJsonAsync("/api/admin/security", new
        {
            currentPassword = Password, loginPath = "/new-door", turnstileEnabled = true,
            turnstileSiteKey = "site", turnstileSecretKey = "secret", turnstileToken = FakeTurnstileVerifier.PassToken,
        });
        await saved.AssertStatusAsync(HttpStatusCode.OK);
        var body = await saved.JsonAsync();
        Assert.Equal("/new-door", body.GetProperty("loginPath").GetString());
        Assert.Equal("site", body.GetProperty("turnstileSiteKey").GetString());
        Assert.True(body.GetProperty("hasTurnstileSecret").GetBoolean());
        Assert.DoesNotContain("\"secret\"", body.GetRawText());

        // The current session survives, the old entrance is gone and logins now need a Turnstile token.
        Assert.True((await admin.GetAsync<JsonElement>("/api/admin/session")).GetProperty("authenticated").GetBoolean());
        var oldEntrance = await factory.CreateAdminClientAsync(login: false);
        await (await oldEntrance.PostJsonAsync("/api/admin/login", new { password = Password })).AssertStatusAsync(HttpStatusCode.NotFound);

        var client = await factory.CreateAdminClientAsync(login: false, entrance: "/new-door");
        Assert.Equal("site", (await client.GetAsync<JsonElement>("/api/admin/login/options")).GetProperty("turnstileSiteKey").GetString());
        var withoutToken = await client.PostJsonAsync("/api/admin/login", new { password = Password });
        await withoutToken.AssertStatusAsync(HttpStatusCode.BadRequest);
        Assert.Equal("turnstile_failed", (await withoutToken.JsonAsync()).GetProperty("error").GetString());
        await (await client.PostJsonAsync("/api/admin/login", new { password = Password, turnstileToken = FakeTurnstileVerifier.PassToken }))
            .AssertStatusAsync(HttpStatusCode.OK);

        // Unchanged keys need no new token; disabling Turnstile clears them.
        var same = await admin.PutJsonAsync("/api/admin/security", new { currentPassword = Password, loginPath = "/new-door", turnstileEnabled = true, turnstileSiteKey = "site" });
        await same.AssertStatusAsync(HttpStatusCode.OK);
        var off = await admin.PutJsonAsync("/api/admin/security", new { currentPassword = Password, loginPath = CashewBlogFactory.EntrancePath, turnstileEnabled = false });
        await off.AssertStatusAsync(HttpStatusCode.OK);
        Assert.False((await off.JsonAsync()).GetProperty("hasTurnstileSecret").GetBoolean());

        var config = await File.ReadAllTextAsync(Path.Combine(factory.DataDirectory, "config.json"));
        Assert.Contains("\"LoginPath\": \"/cashew-door\"", config);
        Assert.Contains("$argon2id$", config);
        Assert.DoesNotContain("EffectiveLoginPath", config);
    }
}
