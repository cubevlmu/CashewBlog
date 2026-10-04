using System.Collections.Concurrent;
using System.Security.Cryptography;
using System.Text;
using CashewBlog.Application.Abstractions;
using CashewBlog.Domain.Entities;
using CashewBlog.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;

namespace CashewBlog.Infrastructure.Security;

/// <summary>Persists bounded, aggregated security incidents without turning an attack into a write flood.</summary>
public sealed class SecurityAlertRecorder(IServiceScopeFactory scopes, IClock clock, ILogger<SecurityAlertRecorder> logger) : ISecurityAlertRecorder
{
    public const int MaximumRetainedEntries = 500;
    private static readonly TimeSpan MinimumWriteInterval = TimeSpan.FromSeconds(30);
    private static readonly TimeSpan GateRetention = TimeSpan.FromMinutes(10);
    private readonly ConcurrentDictionary<string, Gate> gates = new(StringComparer.Ordinal);
    private long nextSweepTicks;

    public async Task RecordAsync(string category, string severity, string sourceIp, string path, string message, CancellationToken cancellationToken = default)
    {
        var now = clock.UtcNow;
        var ip = Limit(sourceIp, 64);
        var route = Limit(path, 512);
        var normalizedCategory = Limit(category, 64);
        var fingerprint = CreateFingerprint(normalizedCategory, ip, route);
        Sweep(now);
        var gate = gates.GetOrAdd(fingerprint, _ => new Gate());
        int increment;
        lock (gate)
        {
            if (gate.LastWriteAt + MinimumWriteInterval > now)
            {
                gate.PendingCount++;
                return;
            }

            increment = gate.PendingCount + 1;
            gate.PendingCount = 0;
            gate.LastWriteAt = now;
        }

        try
        {
            using var scope = scopes.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var existing = await db.SecurityAlerts.SingleOrDefaultAsync(a => a.Fingerprint == fingerprint, cancellationToken);
            if (existing is null)
            {
                db.SecurityAlerts.Add(new SecurityAlert
                {
                    Fingerprint = fingerprint,
                    Category = normalizedCategory,
                    Severity = Limit(severity, 16),
                    SourceIp = ip,
                    Path = route,
                    Message = Limit(message, 512),
                    Count = increment,
                    FirstSeenAt = now,
                    LastSeenAt = now,
                });
            }
            else
            {
                existing.Count += increment;
                existing.LastSeenAt = now;
                if (string.Equals(severity, "Critical", StringComparison.OrdinalIgnoreCase))
                    existing.AcknowledgedAt = null;
            }

            await db.SaveChangesAsync(cancellationToken);
            var excess = await db.SecurityAlerts.CountAsync(cancellationToken) - MaximumRetainedEntries;
            if (excess > 0)
            {
                var ids = await db.SecurityAlerts.AsNoTracking().OrderBy(a => a.LastSeenAt).ThenBy(a => a.Id)
                    .Take(excess).Select(a => a.Id).ToArrayAsync(cancellationToken);
                await db.SecurityAlerts.Where(a => ids.Contains(a.Id)).ExecuteDeleteAsync(cancellationToken);
            }
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Security alert persistence failed for {Category}", normalizedCategory);
        }
    }

    public static string CreateFingerprint(string category, string sourceIp, string path) =>
        Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes($"{category}\n{sourceIp}\n{path}")));

    public static string Limit(string value, int maximumLength) =>
        string.IsNullOrWhiteSpace(value) ? "unknown" : value.Length <= maximumLength ? value : value[..maximumLength];

    private void Sweep(DateTimeOffset now)
    {
        var next = Interlocked.Read(ref nextSweepTicks);
        if (now.UtcTicks < next || Interlocked.CompareExchange(ref nextSweepTicks, now.UtcTicks + GateRetention.Ticks, next) != next)
            return;
        foreach (var entry in gates)
        {
            lock (entry.Value)
            {
                if (entry.Value.LastWriteAt + GateRetention < now)
                    gates.TryRemove(entry.Key, out _);
            }
        }
    }

    private sealed class Gate
    {
        public DateTimeOffset LastWriteAt { get; set; }
        public int PendingCount { get; set; }
    }
}
