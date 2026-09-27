using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using CashewBlog.Application.Posts;

namespace CashewBlog.IntegrationTests.Infrastructure;

public static class HttpExtensions
{
    public static async Task<T> ReadAsync<T>(this HttpResponseMessage response)
    {
        var body = await response.Content.ReadAsStringAsync();
        if (!response.IsSuccessStatusCode)
        {
            throw new HttpRequestException($"{(int)response.StatusCode} {response.StatusCode}: {body}{ServerErrorLog.Recent()}");
        }

        return JsonSerializer.Deserialize<T>(body, CashewBlogFactory.Json)!;
    }

    public static async Task<JsonElement> JsonAsync(this HttpResponseMessage response) =>
        JsonSerializer.Deserialize<JsonElement>(await response.Content.ReadAsStringAsync());

    public static async Task<T> GetAsync<T>(this HttpClient client, string url) => await (await client.GetAsync(url)).ReadAsync<T>();

    public static Task<HttpResponseMessage> PostJsonAsync(this HttpClient client, string url, object? body = null) =>
        client.PostAsJsonAsync(url, body ?? new { }, CashewBlogFactory.Json);

    public static Task<HttpResponseMessage> PutJsonAsync(this HttpClient client, string url, object body) =>
        client.PutAsJsonAsync(url, body, CashewBlogFactory.Json);

    public static async Task AssertStatusAsync(this HttpResponseMessage response, HttpStatusCode expected)
    {
        if (response.StatusCode != expected)
        {
            Assert.Fail($"Expected {(int)expected} but got {(int)response.StatusCode}: {await response.Content.ReadAsStringAsync()}{ServerErrorLog.Recent()}");
        }
    }

    /// <summary>Creates a post through the admin API (optionally publishing it).</summary>
    public static async Task<AdminPostDto> CreatePostAsync(this HttpClient admin, string title, string content = "Body", bool publish = false,
        IReadOnlyList<string>? tags = null, Guid? categoryId = null, Guid? seriesId = null, Guid? coverMediaId = null, string? slug = null)
    {
        var request = PostRequest(title, content, tags, categoryId, seriesId, coverMediaId, slug);
        var post = await (await admin.PostJsonAsync("/api/admin/posts", request)).ReadAsync<AdminPostDto>();
        if (publish)
        {
            post = await (await admin.PostAsync($"/api/admin/posts/{post.Id}/publish", null)).ReadAsync<AdminPostDto>();
        }

        return post;
    }

    public static UpsertPostRequest PostRequest(string title, string content = "Body", IReadOnlyList<string>? tags = null,
        Guid? categoryId = null, Guid? seriesId = null, Guid? coverMediaId = null, string? slug = null) =>
        new(title, slug, null, content, coverMediaId, categoryId, seriesId, null, tags ?? [], false, null, null);
}
