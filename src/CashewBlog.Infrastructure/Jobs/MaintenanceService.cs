using CashewBlog.Application.Abstractions;
using CashewBlog.Application.Analytics;
using CashewBlog.Application.Posts;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace CashewBlog.Infrastructure.Jobs;

public sealed record MaintenanceOptions(bool Enabled, TimeSpan InitialDelay, TimeSpan Interval);

/// <summary>
/// Periodic housekeeping: hard-deletes posts whose 30-day trash retention expired and prunes
/// expired view-dedupe keys. Idle until setup is complete; every step is idempotent.
/// </summary>
public sealed class MaintenanceService(
    IServiceScopeFactory scopes,
    IConfigStore config,
    IClock clock,
    MaintenanceOptions options,
    ILogger<MaintenanceService> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        if (!options.Enabled)
        {
            return;
        }

        try
        {
            await Task.Delay(options.InitialDelay, stoppingToken);
            using var timer = new PeriodicTimer(options.Interval);
            do
            {
                await RunOnceAsync(stoppingToken);
            }
            while (await timer.WaitForNextTickAsync(stoppingToken));
        }
        catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
        {
            // Shutting down.
        }
    }

    public async Task RunOnceAsync(CancellationToken ct)
    {
        if (!config.IsInitialized)
        {
            return;
        }

        try
        {
            using var scope = scopes.CreateScope();
            var purged = await scope.ServiceProvider.GetRequiredService<PostService>().PurgeExpiredAsync(ct);
            var pruned = await scope.ServiceProvider.GetRequiredService<IViewRecorder>().PruneExpiredAsync(clock.UtcNow, ct);
            if (purged > 0 || pruned > 0)
            {
                logger.LogInformation("Maintenance: purged {Posts} expired post(s), pruned {Keys} view-dedupe key(s)", purged, pruned);
            }
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            logger.LogError(ex, "Maintenance run failed; will retry on the next interval");
        }
    }
}
