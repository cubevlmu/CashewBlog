using System.Security.Cryptography;
using System.Text.Json;
using CashewBlog.Application.Abstractions;
using CashewBlog.Application.Common;
using CashewBlog.Application.Settings;
using Microsoft.Extensions.Caching.Memory;

namespace CashewBlog.Api.Hosting;

public sealed record CachedJson(byte[] Body, string ETag);

/// <summary>
/// Caches the serialized bootstrap document. Invalidated by settings/content mutations; also
/// expires after a minute so view totals in the stats block stay reasonably fresh.
/// </summary>
public sealed class PublicCache(IMemoryCache cache) : IPublicCache
{
    private const string BootstrapKey = "cashewblog:bootstrap";
    private static readonly TimeSpan Lifetime = TimeSpan.FromSeconds(60);

    public void Invalidate() => cache.Remove(BootstrapKey);

    public async Task<CachedJson> GetBootstrapAsync(BootstrapService service, CancellationToken ct)
    {
        if (cache.TryGetValue(BootstrapKey, out CachedJson? cached) && cached is not null)
        {
            return cached;
        }

        var dto = await service.BuildAsync(ct);
        var body = JsonSerializer.SerializeToUtf8Bytes(dto, AppJson.Options);
        var etag = "\"" + Convert.ToHexStringLower(SHA256.HashData(body))[..20] + "\"";
        cached = new CachedJson(body, etag);
        cache.Set(BootstrapKey, cached, Lifetime);
        return cached;
    }
}
