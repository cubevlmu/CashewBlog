using System.Net;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using CashewBlog.Application.Common;
using CashewBlog.Application.Media;
using CashewBlog.Domain.Entities;
using CashewBlog.IntegrationTests.Infrastructure;
using SixLabors.ImageSharp;
using SixLabors.ImageSharp.PixelFormats;

namespace CashewBlog.IntegrationTests;

public class MediaTests(CashewBlogFactory factory) : IClassFixture<CashewBlogFactory>
{
    private static byte[] Png(int width, int height)
    {
        using var image = new Image<Rgba32>(width, height, new Rgba32(200, 120, 40));
        using var stream = new MemoryStream();
        image.SaveAsPng(stream);
        return stream.ToArray();
    }

    private static MultipartFormDataContent Form(byte[] bytes, string fileName, string contentType, string? alt = null)
    {
        var form = new MultipartFormDataContent();
        var file = new ByteArrayContent(bytes);
        file.Headers.ContentType = new MediaTypeHeaderValue(contentType);
        form.Add(file, "file", fileName);
        if (alt is not null)
        {
            form.Add(new StringContent(alt), "altText");
        }

        return form;
    }

    [Fact]
    public async Task Image_upload_generates_variants_and_references_block_delete()
    {
        var admin = await factory.CreateAdminClientAsync();
        var anonymous = factory.CreateBrowserClient();

        var asset = await (await admin.PostAsync("/api/admin/media", Form(Png(3000, 1500), "photo.png", "image/png", "封面"))).ReadAsync<MediaAssetDto>();
        Assert.Equal(MediaKind.Image, asset.Kind);
        Assert.Equal(3000, asset.Width);
        Assert.Equal("image/png", asset.MimeType);
        Assert.Equal("封面", asset.AltText);
        Assert.Matches(@"^/uploads/\d{4}/\d{2}/[0-9a-f-]{36}-display\.webp$", asset.Url);
        Assert.Matches(@"-original\.png$", asset.OriginalUrl);
        Assert.Matches(@"-thumb\.webp$", asset.ThumbUrl!);
        Assert.Equal(64, asset.Sha256!.Length);

        var display = await anonymous.GetAsync(asset.Url);
        await display.AssertStatusAsync(HttpStatusCode.OK);
        Assert.Equal("image/webp", display.Content.Headers.ContentType?.MediaType);
        Assert.Equal("nosniff", display.Headers.GetValues("X-Content-Type-Options").Single());
        Assert.True(display.Headers.CacheControl?.MaxAge > TimeSpan.FromDays(300));
        using (var decoded = Image.Load(await display.Content.ReadAsByteArrayAsync()))
        {
            Assert.Equal(2560, decoded.Width);
            Assert.Equal(1280, decoded.Height);
        }

        // Use it as a post cover and inside the body.
        var post = await admin.CreatePostAsync("With media", $"![x]({asset.Url})", coverMediaId: asset.Id, publish: true);
        Assert.Equal(asset.Url, post.Cover?.Url);
        Assert.Equal(2560, post.Cover?.Width);
        Assert.Equal(1280, post.Cover?.Height);

        var blocked = await admin.DeleteAsync($"/api/admin/media/{asset.Id}");
        await blocked.AssertStatusAsync(HttpStatusCode.Conflict);
        var problem = await blocked.JsonAsync();
        Assert.Equal("media_in_use", problem.GetProperty("error").GetString());
        var refs = problem.GetProperty("references").EnumerateArray().ToList();
        Assert.Contains(refs, r => r.GetProperty("fieldKey").GetString() == "cover" && r.GetProperty("title").GetString() == "With media");
        Assert.Contains(refs, r => r.GetProperty("fieldKey").GetString() == "body" && r.GetProperty("ownerType").GetString() == "post");

        // Remove both references; delete now succeeds and files are gone.
        await (await admin.PutJsonAsync($"/api/admin/posts/{post.Id}", HttpExtensions.PostRequest("With media", "no media"))).AssertStatusAsync(HttpStatusCode.OK);
        var references = await admin.GetAsync<List<MediaReferenceDto>>($"/api/admin/media/{asset.Id}/references");
        Assert.Empty(references);
        await (await admin.DeleteAsync($"/api/admin/media/{asset.Id}")).AssertStatusAsync(HttpStatusCode.NoContent);
        await (await anonymous.GetAsync(asset.Url)).AssertStatusAsync(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task Settings_references_block_delete_too()
    {
        var admin = await factory.CreateAdminClientAsync();
        var asset = await (await admin.PostAsync("/api/admin/media", Form(Png(64, 64), "avatar.png", "image/png"))).ReadAsync<MediaAssetDto>();

        await (await admin.PutJsonAsync("/api/admin/settings", new { profile = new { name = "Me", avatar = asset.Url } })).AssertStatusAsync(HttpStatusCode.OK);
        var blocked = await admin.DeleteAsync($"/api/admin/media/{asset.Id}");
        await blocked.AssertStatusAsync(HttpStatusCode.Conflict);
        var reference = (await blocked.JsonAsync()).GetProperty("references")[0];
        Assert.Equal("siteSettings", reference.GetProperty("ownerType").GetString());
        Assert.Equal("avatar", reference.GetProperty("fieldKey").GetString());
    }

    [Fact]
    public async Task Attachments_are_served_as_downloads()
    {
        var admin = await factory.CreateAdminClientAsync();
        var bytes = Encoding.UTF8.GetBytes("<html><script>alert(1)</script></html>");
        var asset = await (await admin.PostAsync("/api/admin/media", Form(bytes, "evil.html", "text/html"))).ReadAsync<MediaAssetDto>();

        Assert.Equal(MediaKind.Attachment, asset.Kind);
        Assert.Null(asset.ThumbUrl);
        Assert.Matches(@"^/uploads/\d{4}/\d{2}/[0-9a-f-]{36}\.html$", asset.Url);
        Assert.Equal("evil.html", asset.OriginalFileName);

        var response = await factory.CreateBrowserClient().GetAsync(asset.Url);
        await response.AssertStatusAsync(HttpStatusCode.OK);
        Assert.Equal("attachment", response.Content.Headers.ContentDisposition?.DispositionType);
        Assert.Equal("nosniff", response.Headers.GetValues("X-Content-Type-Options").Single());
        Assert.Contains("sandbox", response.Headers.GetValues("Content-Security-Policy").Single());
    }

    [Fact]
    public async Task Listing_filters_and_alt_text_update()
    {
        var admin = await factory.CreateAdminClientAsync();
        var image = await (await admin.PostAsync("/api/admin/media", Form(Png(10, 10), "listing-cat.png", "image/png"))).ReadAsync<MediaAssetDto>();
        await (await admin.PostAsync("/api/admin/media", Form("hello"u8.ToArray(), "listing-notes.txt", "text/plain"))).AssertStatusAsync(HttpStatusCode.Created);

        var images = await admin.GetAsync<PagedResult<MediaAssetDto>>("/api/admin/media?kind=image&q=listing");
        Assert.All(images.Items, i => Assert.Equal(MediaKind.Image, i.Kind));
        Assert.Contains(images.Items, i => i.Id == image.Id);
        var attachments = await admin.GetAsync<PagedResult<MediaAssetDto>>("/api/admin/media?kind=attachment&q=listing");
        Assert.Single(attachments.Items);

        var updated = await (await admin.PatchAsync($"/api/admin/media/{image.Id}",
            new StringContent(JsonSerializer.Serialize(new { altText = "A cat" }), Encoding.UTF8, "application/json"))).ReadAsync<MediaAssetDto>();
        Assert.Equal("A cat", updated.AltText);
    }

    [Fact]
    public async Task Uploads_path_traversal_is_rejected()
    {
        var client = factory.CreateBrowserClient();
        await (await client.GetAsync("/uploads/..%2Fdata%2Fconfig.json")).AssertStatusAsync(HttpStatusCode.NotFound);
        await (await client.GetAsync("/uploads/..%5C..%5Cdata%5Cconfig.json")).AssertStatusAsync(HttpStatusCode.NotFound);
        await (await client.GetAsync("/uploads/2026/01/C:%2FWindows%2Fwin.ini")).AssertStatusAsync(HttpStatusCode.NotFound);
    }
}
