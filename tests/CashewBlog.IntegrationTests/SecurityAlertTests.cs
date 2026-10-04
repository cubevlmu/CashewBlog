using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using CashewBlog.IntegrationTests.Infrastructure;

namespace CashewBlog.IntegrationTests;

public sealed class SecurityAlertTests(CashewBlogFactory factory) : IClassFixture<CashewBlogFactory>
{
    [Fact]
    public async Task Route_probe_is_reported_and_can_be_acknowledged_and_deleted()
    {
        var client = await factory.CreateAdminClientAsync();
        await (await client.GetAsync("/.env")).AssertStatusAsync(HttpStatusCode.NotFound);

        var page = await client.GetFromJsonAsync<JsonElement>("/api/admin/security-alerts?category=RouteProbe");
        Assert.True(page.GetProperty("activeCount").GetInt64() > 0);
        var item = page.GetProperty("items")[0];
        var id = item.GetProperty("id").GetInt64();
        Assert.Equal("RouteProbe", item.GetProperty("category").GetString());

        await (await client.PostAsync($"/api/admin/security-alerts/{id}/acknowledge", null)).AssertStatusAsync(HttpStatusCode.NoContent);
        var history = await client.GetFromJsonAsync<JsonElement>("/api/admin/security-alerts?includeAcknowledged=true&category=RouteProbe");
        Assert.NotEqual(JsonValueKind.Null, history.GetProperty("items")[0].GetProperty("acknowledgedAt").ValueKind);

        await (await client.DeleteAsync($"/api/admin/security-alerts/{id}")).AssertStatusAsync(HttpStatusCode.NoContent);
    }
}
