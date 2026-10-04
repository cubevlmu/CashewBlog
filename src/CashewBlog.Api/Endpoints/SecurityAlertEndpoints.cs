using CashewBlog.Application.Abstractions;
using CashewBlog.Api.Hosting;
using CashewBlog.Domain.Entities;
using CashewBlog.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace CashewBlog.Api.Endpoints;

public static class SecurityAlertEndpoints
{
    public static void MapSecurityAlertEndpoints(this RouteGroupBuilder secured)
    {
        secured.MapGet("/security-alerts", async (bool? includeAcknowledged, string? severity, string? category,
            int? offset, int? limit, AppDbContext db, CancellationToken ct) =>
        {
            var take = Math.Clamp(limit ?? 20, 1, 100);
            var skip = Math.Max(0, offset ?? 0);
            var query = db.SecurityAlerts.AsNoTracking();
            if (includeAcknowledged != true) query = query.Where(a => a.AcknowledgedAt == null);
            if (severity is "Critical" or "Warning") query = query.Where(a => a.Severity == severity);
            if (!string.IsNullOrWhiteSpace(category)) query = query.Where(a => a.Category == category);

            var total = await query.LongCountAsync(ct);
            var active = await db.SecurityAlerts.AsNoTracking().LongCountAsync(a => a.AcknowledgedAt == null, ct);
            var items = await query.OrderByDescending(a => a.LastSeenAt).ThenByDescending(a => a.Id)
                .Skip(skip).Take(take)
                .Select(a => new SecurityAlertDto(a.Id, a.Category, a.Severity, a.SourceIp, a.Path, a.Message,
                    a.Count, a.FirstSeenAt, a.LastSeenAt, a.AcknowledgedAt))
                .ToArrayAsync(ct);
            return Results.Ok(new SecurityAlertPageDto(items, skip, take, total, active));
        });

        secured.MapPost("/security-alerts/{id:long}/acknowledge", async (long id, AppDbContext db, IClock clock, CancellationToken ct) =>
        {
            var changed = await db.SecurityAlerts.Where(a => a.Id == id)
                .ExecuteUpdateAsync(s => s.SetProperty(a => a.AcknowledgedAt, clock.UtcNow), ct);
            return changed == 0 ? ApiErrors.NotFound() : Results.NoContent();
        });

        secured.MapPost("/security-alerts/acknowledge-all", async (AppDbContext db, IClock clock, CancellationToken ct) =>
        {
            await db.SecurityAlerts.Where(a => a.AcknowledgedAt == null)
                .ExecuteUpdateAsync(s => s.SetProperty(a => a.AcknowledgedAt, clock.UtcNow), ct);
            return Results.NoContent();
        });

        secured.MapDelete("/security-alerts/{id:long}", async (long id, AppDbContext db, CancellationToken ct) =>
        {
            var changed = await db.SecurityAlerts.Where(a => a.Id == id).ExecuteDeleteAsync(ct);
            return changed == 0 ? ApiErrors.NotFound() : Results.NoContent();
        });
    }
}

public sealed record SecurityAlertDto(long Id, string Category, string Severity, string SourceIp, string Path,
    string Message, int Count, DateTimeOffset FirstSeenAt, DateTimeOffset LastSeenAt, DateTimeOffset? AcknowledgedAt);

public sealed record SecurityAlertPageDto(SecurityAlertDto[] Items, int Offset, int Limit, long TotalCount, long ActiveCount);
