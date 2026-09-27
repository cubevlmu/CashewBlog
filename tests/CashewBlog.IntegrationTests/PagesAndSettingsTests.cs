using System.Net;
using System.Net.Http.Headers;
using System.Text.Json;
using CashewBlog.Application.Admin;
using CashewBlog.Application.CustomPages;
using CashewBlog.Domain.Entities;
using CashewBlog.IntegrationTests.Infrastructure;

namespace CashewBlog.IntegrationTests;

public class CustomPageTests(CashewBlogFactory factory) : IClassFixture<CashewBlogFactory>
{
    [Fact]
    public async Task Nested_slug_page_is_public_and_sanitized()
    {
        var admin = await factory.CreateAdminClientAsync();
        var created = await (await admin.PostJsonAsync("/api/admin/pages", new
        {
            title = "Friends",
            slug = "links/friends",
            contentHtml = """<div class="grid" onclick="steal()"><script>alert(1)</script><a href="javascript:alert(1)">x</a><p style="color: red">hi</p></div>""",
            customCss = ".grid { display: grid; }",
            layout = "wide",
        })).ReadAsync<CustomPageDto>();

        Assert.Equal("links/friends", created.Slug);
        Assert.Equal(PageLayout.Wide, created.Layout);
        Assert.DoesNotContain("<script", created.ContentHtml);
        Assert.DoesNotContain("onclick", created.ContentHtml);
        Assert.DoesNotContain("javascript:", created.ContentHtml);
        Assert.Contains("class=\"grid\"", created.ContentHtml);

        var page = await factory.CreateBrowserClient().GetAsync<JsonElement>("/api/pages/links/friends");
        Assert.Equal("Friends", page.GetProperty("title").GetString());
        Assert.Equal("wide", page.GetProperty("layout").GetString());
        Assert.Equal(".grid { display: grid; }", page.GetProperty("customCss").GetString());
        Assert.True(page.TryGetProperty("createdAt", out _));

        var bootstrap = await factory.CreateBrowserClient().GetAsync<JsonElement>("/api/site/bootstrap");
        Assert.Contains(bootstrap.GetProperty("pages").EnumerateArray(), p => p.GetProperty("slug").GetString() == "links/friends");

        await (await factory.CreateBrowserClient().GetAsync("/api/pages/links/unknown")).AssertStatusAsync(HttpStatusCode.NotFound);
    }

    [Theory]
    [InlineData("admin")]
    [InlineData("posts/mine")]
    [InlineData("rss.xml")]
    [InlineData("archive")]
    public async Task Reserved_slugs_are_rejected(string slug)
    {
        var admin = await factory.CreateAdminClientAsync();
        var response = await admin.PostJsonAsync("/api/admin/pages", new { title = "Nope", slug, contentHtml = "<p>x</p>" });
        await response.AssertStatusAsync(HttpStatusCode.BadRequest);
        Assert.True((await response.JsonAsync()).GetProperty("errors").TryGetProperty("slug", out _));
    }
}

public class SettingsTests(CashewBlogFactory factory) : IClassFixture<CashewBlogFactory>
{
    [Fact]
    public async Task Partial_update_validation_reset_and_bootstrap_etag()
    {
        var admin = await factory.CreateAdminClientAsync();
        var anonymous = factory.CreateBrowserClient();

        var first = await anonymous.GetAsync("/api/site/bootstrap");
        await first.AssertStatusAsync(HttpStatusCode.OK);
        var etag = first.Headers.ETag!;

        using (var conditional = new HttpRequestMessage(HttpMethod.Get, "/api/site/bootstrap"))
        {
            conditional.Headers.IfNoneMatch.Add(etag);
            Assert.Equal(HttpStatusCode.NotModified, (await anonymous.SendAsync(conditional)).StatusCode);
        }

        // Partial update: only the given sections change; footer HTML is stored verbatim (trusted).
        var footer = "<script>console.log('trusted')</script>";
        var updated = await (await admin.PutJsonAsync("/api/admin/settings", new
        {
            general = new { siteName = "Renamed", siteUrl = "https://renamed.example/", timezone = "Asia/Tokyo" },
            footer = new { html = footer },
        })).ReadAsync<JsonElement>();
        Assert.Equal("Renamed", updated.GetProperty("general").GetProperty("siteName").GetString());
        Assert.Equal(footer, updated.GetProperty("footer").GetProperty("html").GetString());
        Assert.Equal("tonalSpot", updated.GetProperty("appearance").GetProperty("themeStyle").GetString());

        // Cache invalidated: new ETag and content.
        var second = await anonymous.GetAsync("/api/site/bootstrap");
        Assert.NotEqual(etag, second.Headers.ETag);
        var bootstrap = await second.JsonAsync();
        Assert.Equal("Renamed", bootstrap.GetProperty("settings").GetProperty("general").GetProperty("siteName").GetString());
        Assert.False(bootstrap.GetProperty("settings").TryGetProperty("dashboard", out _));
        Assert.True(bootstrap.GetProperty("stats").TryGetProperty("postCount", out _));

        // Validation: nav depth > 2 and unknown enum values are rejected.
        var tooDeep = await admin.PutJsonAsync("/api/admin/settings", new
        {
            navigation = new[]
            {
                new { id = "a", label = "A", type = "url", target = "/a", children = new[]
                {
                    new { id = "b", label = "B", type = "url", target = "/b", children = new[] { new { id = "c", label = "C", type = "home" } } },
                } },
            },
        });
        await tooDeep.AssertStatusAsync(HttpStatusCode.BadRequest);

        var badEnum = await admin.PutJsonAsync("/api/admin/settings", new { appearance = new { themeStyle = "sparkly" } });
        await badEnum.AssertStatusAsync(HttpStatusCode.BadRequest);

        var unknownSection = await admin.PutJsonAsync("/api/admin/settings", new { database = new { host = "x" } });
        await unknownSection.AssertStatusAsync(HttpStatusCode.BadRequest);

        // Reset one section to defaults.
        var reset = await (await admin.PostAsync("/api/admin/settings/reset/footer", null)).ReadAsync<JsonElement>();
        Assert.Equal("", reset.GetProperty("footer").GetProperty("html").GetString());
        Assert.Equal("Renamed", reset.GetProperty("general").GetProperty("siteName").GetString());
        await (await admin.PostAsync("/api/admin/settings/reset/nope", null)).AssertStatusAsync(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task Dashboard_layout_persists()
    {
        var admin = await factory.CreateAdminClientAsync();
        var widgets = new[] { new { id = "totalPosts", x = 0, y = 0, w = 4, h = 2, visible = false } };
        await (await admin.PutJsonAsync("/api/admin/settings", new { dashboard = new { widgets } })).AssertStatusAsync(HttpStatusCode.OK);

        var settings = await admin.GetAsync<JsonElement>("/api/admin/settings");
        var saved = settings.GetProperty("dashboard").GetProperty("widgets")[0];
        Assert.Equal(4, saved.GetProperty("w").GetInt32());
        Assert.False(saved.GetProperty("visible").GetBoolean());
    }

    [Fact]
    public async Task System_info_health_and_exports()
    {
        var admin = await factory.CreateAdminClientAsync();

        var info = await admin.GetAsync<SystemInfoDto>("/api/admin/system/info");
        Assert.True(info.Database.Healthy);
        Assert.False(string.IsNullOrEmpty(info.Version));
        Assert.Contains(".NET", info.DotnetVersion);

        var health = await admin.GetAsync<SystemHealthDto>("/api/admin/system/health");
        Assert.Contains(health.Components, c => c.Name == "database" && c.Healthy);

        await admin.CreatePostAsync("Exported \"post\"", "# Hello");
        var zip = await admin.GetAsync("/api/admin/export/posts");
        await zip.AssertStatusAsync(HttpStatusCode.OK);
        Assert.Equal("application/zip", zip.Content.Headers.ContentType?.MediaType);
        using var archive = new System.IO.Compression.ZipArchive(await zip.Content.ReadAsStreamAsync());
        var entry = archive.Entries.Single(e => e.FullName == "posts/exported-post.md");
        using var reader = new StreamReader(entry.Open());
        var text = await reader.ReadToEndAsync();
        Assert.StartsWith("---\ntitle: \"Exported \\\"post\\\"\"", text);
        Assert.Contains("# Hello", text);

        var settingsExport = await admin.GetAsync("/api/admin/export/settings");
        Assert.Equal(new MediaTypeHeaderValue("application/json").MediaType, settingsExport.Content.Headers.ContentType?.MediaType);
    }

    [Fact]
    public async Task Password_change_invalidates_old_sessions()
    {
        var first = await factory.CreateAdminClientAsync();
        var second = await factory.CreateAdminClientAsync();

        const string newPassword = "another-password-456";
        await (await first.PostJsonAsync("/api/admin/password", new { currentPassword = CashewBlogFactory.AdminPassword, newPassword }))
            .AssertStatusAsync(HttpStatusCode.NoContent);

        await (await first.GetAsync("/api/admin/posts")).AssertStatusAsync(HttpStatusCode.OK);
        await (await second.GetAsync("/api/admin/posts")).AssertStatusAsync(HttpStatusCode.Unauthorized);

        // The re-issued session has a new antiforgery token (the XSRF-TOKEN cookie was updated).
        await CashewBlogFactory.RefreshCsrfAsync(first);

        // Restore for other tests in this class.
        await (await first.PostJsonAsync("/api/admin/password", new { currentPassword = newPassword, newPassword = CashewBlogFactory.AdminPassword }))
            .AssertStatusAsync(HttpStatusCode.NoContent);
    }
}
