using System.Globalization;
using System.Text.Json;
using System.Text.Json.Nodes;
using CashewBlog.Application.Abstractions;
using CashewBlog.Application.Analytics;
using CashewBlog.Application.Common;
using CashewBlog.Application.Taxonomy;
using CashewBlog.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace CashewBlog.Application.Settings;

public sealed record SiteStatsDto(
    int PostCount,
    long TotalWords,
    long TotalViews,
    string? SiteStartDate,
    int? SiteAgeDays,
    DateTimeOffset? LastUpdatedAt);

public sealed record RecentPostLinkDto(string Slug, string Title, DateTimeOffset? PublishedAt);

public sealed record PageLinkDto(string Title, string Slug);

/// <summary>Everything the public shell needs in one request. <c>Settings</c> excludes the dashboard section.</summary>
public sealed record BootstrapDto(
    JsonObject Settings,
    SiteStatsDto Stats,
    IReadOnlyList<CategorySummaryDto> Categories,
    IReadOnlyList<TagSummaryDto> Tags,
    IReadOnlyList<SeriesSummaryDto> Series,
    IReadOnlyList<RecentPostLinkDto> RecentPosts,
    IReadOnlyList<PageLinkDto> Pages,
    string Version);

public interface IAppInfo
{
    string Version { get; }
    DateTimeOffset StartedAt { get; }
}

public sealed class BootstrapService(
    IApplicationDbContext db,
    IClock clock,
    SettingsService settingsService,
    TaxonomyService taxonomy,
    IAppInfo appInfo)
{
    public const int RecentPostCount = 5;

    public async Task<BootstrapDto> BuildAsync(CancellationToken ct)
    {
        var settings = await settingsService.GetAsync(ct);
        var node = JsonSerializer.SerializeToNode(settings, AppJson.Options)!.AsObject();
        node.Remove("dashboard");

        var published = db.Posts.AsNoTracking().Where(p => p.Status == PostStatus.Published);
        var stats = await published
            .GroupBy(_ => 1)
            .Select(g => new
            {
                Count = g.Count(),
                Words = g.Sum(p => (long)p.WordCount),
                Views = g.Sum(p => p.ViewCount),
                LastUpdated = g.Max(p => (DateTimeOffset?)p.UpdatedAt),
            })
            .FirstOrDefaultAsync(ct);

        int? ageDays = null;
        if (DateOnly.TryParseExact(settings.General.SiteStartDate, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var start))
        {
            var today = AnalyticsService.LocalDate(clock.UtcNow, settings.General.Timezone);
            ageDays = Math.Max(0, today.DayNumber - start.DayNumber);
        }

        var recent = await published.OrderByDescending(p => p.PublishedAt).Take(RecentPostCount)
            .Select(p => new RecentPostLinkDto(p.Slug, p.Title, p.PublishedAt))
            .ToListAsync(ct);
        var pages = await db.CustomPages.AsNoTracking().OrderBy(p => p.Slug)
            .Select(p => new PageLinkDto(p.Title, p.Slug))
            .ToListAsync(ct);

        return new BootstrapDto(
            node,
            new SiteStatsDto(stats?.Count ?? 0, stats?.Words ?? 0, stats?.Views ?? 0, settings.General.SiteStartDate, ageDays, stats?.LastUpdated),
            await taxonomy.PublicCategoriesAsync(ct),
            await taxonomy.PublicTagsAsync(ct),
            await taxonomy.PublicSeriesAsync(ct),
            recent,
            pages,
            appInfo.Version);
    }
}
