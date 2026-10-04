using System.Net.Http.Json;
using System.Text.Json.Serialization;
using CashewBlog.Application.Abstractions;
using Microsoft.Extensions.Logging;

namespace CashewBlog.Infrastructure.Security;

/// <summary>
/// Calls Cloudflare siteverify. Fails closed: a timeout or network error rejects the attempt; operators
/// who lose access can clear <c>Admin.Turnstile</c> in config.json and restart.
/// </summary>
public sealed class CloudflareTurnstileVerifier(IHttpClientFactory clients, ILogger<CloudflareTurnstileVerifier> logger) : ITurnstileVerifier
{
    public const string ClientName = "turnstile";
    private static readonly Uri Endpoint = new("https://challenges.cloudflare.com/turnstile/v0/siteverify");

    public async Task<bool> VerifyAsync(string secretKey, string? token, string? remoteIp, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(token) || token.Length > 2048)
        {
            return false;
        }

        var form = new Dictionary<string, string> { ["secret"] = secretKey, ["response"] = token };
        if (!string.IsNullOrEmpty(remoteIp))
        {
            form["remoteip"] = remoteIp;
        }

        try
        {
            using var client = clients.CreateClient(ClientName);
            using var response = await client.PostAsync(Endpoint, new FormUrlEncodedContent(form), ct);
            var result = await response.Content.ReadFromJsonAsync<SiteverifyResponse>(ct);
            if (result?.Success == true)
            {
                return true;
            }

            logger.LogWarning("Turnstile rejected a token: {Errors}", string.Join(", ", result?.ErrorCodes ?? ["no response body"]));
            return false;
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException or System.Text.Json.JsonException)
        {
            logger.LogWarning(ex, "Turnstile siteverify is unreachable; rejecting the attempt");
            return false;
        }
    }

    private sealed record SiteverifyResponse(
        [property: JsonPropertyName("success")] bool Success,
        [property: JsonPropertyName("error-codes")] string[]? ErrorCodes);
}
