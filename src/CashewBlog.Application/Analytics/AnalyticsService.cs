using System.Security.Cryptography;
using System.Text;
using CashewBlog.Application.Abstractions;
using CashewBlog.Application.Common;
using CashewBlog.Application.Settings;
using CashewBlog.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace CashewBlog.Application.Analytics;

public sealed record ViewResult(bool Counted, long ViewCount);

public sealed record DailyViewsDto(DateOnly Date, long Views);

public sealed record TopPostDto(Guid Id, string Title, string Slug, long ViewCount);

public sealed record RecentPostDto(Guid Id, string Title, string Slug, PostStatus Status, DateTimeOffset UpdatedAt, DateTimeOffset? PublishedAt);

public sealed record AnalyticsOverviewDto(
    int TotalPosts,
    int PublishedPosts,
    int Drafts,
    int PrivatePosts,
    int Trash,
    long TotalViews,
    long TodayViews,
    string Range,
    string Timezone,
    IReadOnlyList<DailyViewsDto> Daily,
    IReadOnlyList<TopPostDto> TopPosts,
    IReadOnlyList<RecentPostDto> RecentPosts);

public sealed record PostAnalyticsDto(
    Guid Id, string Title, string Slug, PostStatus Status, DateTimeOffset? PublishedAt,
    long ViewCount, long TodayViews, long Views7d, long Views30d);

/// <summary>Atomic dedupe + counter update (PostgreSQL upserts). Implemented in Infrastructure.</summary>
public interface IViewRecorder
{
    /// <summary>
    /// Inserts/refreshes the dedupe key; when the visitor was not seen within the window,
    /// increments Posts.ViewCount and PostDailyStats(date). Returns (counted, current total).
    /// </summary>
    Task<(bool Counted, long ViewCount)> RecordAsync(Guid postId, string visitorHash, DateOnly date, DateTimeOffset now, TimeSpan window, CancellationToken ct);

    Task<int> PruneExpiredAsync(DateTimeOffset now, CancellationToken ct);
}

/// <summary>Server-side secret mixed into visitor hashes (persisted under the data directory).</summary>
public interface IVisitorPepper
{
    byte[] Value { get; }
}

public static class VisitorHasher
{
    public static readonly TimeSpan DedupeWindow = TimeSpan.FromMinutes(30);

    /// <summary>SHA-256(ip | user-agent | pepper) as lower-case hex. Raw IPs are never stored.</summary>
    public static string Hash(string? ip, string? userAgent, byte[] pepper)
    {
        var material = Encoding.UTF8.GetBytes($"{ip ?? ""}\n{userAgent ?? ""}\n");
        var buffer = new byte[material.Length + pepper.Length];
        material.CopyTo(buffer, 0);
        pepper.CopyTo(buffer, material.Length);
        return Convert.ToHexStringLower(SHA256.HashData(buffer));
    }
}

public sealed class AnalyticsService(
    IApplicationDbContext db,
    IClock clock,
    SettingsService settings,
    IViewRecorder recorder,
    IVisitorPepper pepper)
{
    /// <summary>
    /// Counts a view for a Published post, at most once per visitor per 30 minutes.
    /// Daily buckets use the site time zone. Returns null when the post is not public.
    /// </summary>
    public async Task<ViewResult?> RecordViewAsync(string slug, string? ip, string? userAgent, CancellationToken ct)
    {
        var postId = await db.Posts.Where(p => p.Slug == slug && p.Status == PostStatus.Published)
            .Select(p => (Guid?)p.Id).FirstOrDefaultAsync(ct);
        if (postId is null)
        {
            return null;
        }

        var now = clock.UtcNow;
        var today = await TodayAsync(now, ct);
        var hash = VisitorHasher.Hash(ip, userAgent, pepper.Value);
        var (counted, total) = await recorder.RecordAsync(postId.Value, hash, today, now, VisitorHasher.DedupeWindow, ct);
        return new ViewResult(counted, total);
    }

    public async Task<AnalyticsOverviewDto> OverviewAsync(string? range, CancellationToken ct)
    {
        var days = range == "30d" ? 30 : 7;
        var site = await settings.GetAsync(ct);
        var now = clock.UtcNow;
        var today = LocalDate(now, site.General.Timezone);
        var from = today.AddDays(-(days - 1));

        var counts = await db.Posts.GroupBy(p => p.Status).Select(g => new { g.Key, Count = g.Count() }).ToListAsync(ct);
        int Count(PostStatus s) => counts.FirstOrDefault(c => c.Key == s)?.Count ?? 0;
        var trash = await db.Posts.IgnoreQueryFilters().CountAsync(p => p.DeletedAt != null, ct);
        var totalViews = await db.Posts.SumAsync(p => p.ViewCount, ct);

        var daily = await db.PostDailyStats.Where(s => s.Date >= from && s.Date <= today)
            .GroupBy(s => s.Date)
            .Select(g => new { Date = g.Key, Views = g.Sum(s => s.Views) })
            .ToListAsync(ct);
        var series = Enumerable.Range(0, days)
            .Select(i => from.AddDays(i))
            .Select(d => new DailyViewsDto(d, daily.FirstOrDefault(x => x.Date == d)?.Views ?? 0))
            .ToList();

        var top = await db.Posts.Where(p => p.Status == PostStatus.Published)
            .OrderByDescending(p => p.ViewCount).ThenByDescending(p => p.PublishedAt).Take(10)
            .Select(p => new TopPostDto(p.Id, p.Title, p.Slug, p.ViewCount))
            .ToListAsync(ct);
        var recent = await db.Posts.OrderByDescending(p => p.UpdatedAt).Take(10)
            .Select(p => new RecentPostDto(p.Id, p.Title, p.Slug, p.Status, p.UpdatedAt, p.PublishedAt))
            .ToListAsync(ct);

        return new AnalyticsOverviewDto(
            counts.Sum(c => c.Count),
            Count(PostStatus.Published),
            Count(PostStatus.Draft),
            Count(PostStatus.Private),
            trash,
            totalViews,
            series[^1].Views,
            $"{days}d",
            site.General.Timezone,
            series,
            top,
            recent);
    }

    /// <summary>Per-post view table. Sort: views (default), today, views7d, views30d, title, publishedAt.</summary>
    public async Task<PagedResult<PostAnalyticsDto>> PostsAsync(string? sort, int? page, int? pageSize, CancellationToken ct)
    {
        var (p, size) = Paging.Normalize(page, pageSize, 20, 100);
        var today = await TodayAsync(clock.UtcNow, ct);
        var d7 = today.AddDays(-6);
        var d30 = today.AddDays(-29);

        // Anonymous projection first (EF can order by its members), DTO mapping after paging.
        var query = db.Posts.Select(x => new
        {
            x.Id,
            x.Title,
            x.Slug,
            x.Status,
            x.PublishedAt,
            x.ViewCount,
            Today = db.PostDailyStats.Where(s => s.PostId == x.Id && s.Date == today).Sum(s => (long?)s.Views) ?? 0,
            Views7d = db.PostDailyStats.Where(s => s.PostId == x.Id && s.Date >= d7).Sum(s => (long?)s.Views) ?? 0,
            Views30d = db.PostDailyStats.Where(s => s.PostId == x.Id && s.Date >= d30).Sum(s => (long?)s.Views) ?? 0,
        });

        query = sort switch
        {
            "today" => query.OrderByDescending(x => x.Today).ThenByDescending(x => x.ViewCount),
            "views7d" => query.OrderByDescending(x => x.Views7d).ThenByDescending(x => x.ViewCount),
            "views30d" => query.OrderByDescending(x => x.Views30d).ThenByDescending(x => x.ViewCount),
            "title" => query.OrderBy(x => x.Title),
            "publishedAt" => query.OrderByDescending(x => x.PublishedAt),
            _ => query.OrderByDescending(x => x.ViewCount).ThenByDescending(x => x.PublishedAt),
        };

        var rows = await query.ToPagedAsync(p, size, ct);
        return new PagedResult<PostAnalyticsDto>(
            rows.Items.Select(x => new PostAnalyticsDto(x.Id, x.Title, x.Slug, x.Status, x.PublishedAt, x.ViewCount, x.Today, x.Views7d, x.Views30d)).ToList(),
            rows.Page, rows.PageSize, rows.TotalItems);
    }

    private async Task<DateOnly> TodayAsync(DateTimeOffset now, CancellationToken ct) =>
        LocalDate(now, (await settings.GetAsync(ct)).General.Timezone);

    public static DateOnly LocalDate(DateTimeOffset now, string? timezone) =>
        DateOnly.FromDateTime(TimeZoneInfo.ConvertTime(now, SettingsService.ResolveTimeZone(timezone)).DateTime);
}
