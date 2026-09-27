using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Npgsql;

namespace CashewBlog.Infrastructure.Persistence;

/// <summary>Applies bundled EF migrations under a PostgreSQL advisory lock so concurrent instances never migrate at once.</summary>
public static class MigrationRunner
{
    // Arbitrary application-wide key ("CashewBl" as ASCII).
    private const long AdvisoryLockKey = 0x4361736865774261;

    public static async Task MigrateAsync(string connectionString, ILogger logger, CancellationToken ct = default)
    {
        await using var lockConnection = new NpgsqlConnection(connectionString);
        await lockConnection.OpenAsync(ct);

        await using (var acquire = new NpgsqlCommand("SELECT pg_advisory_lock(@key)", lockConnection))
        {
            acquire.Parameters.AddWithValue("key", AdvisoryLockKey);
            await acquire.ExecuteNonQueryAsync(ct);
        }

        try
        {
            var options = new DbContextOptionsBuilder<AppDbContext>().UseNpgsql(connectionString).Options;
            await using var db = new AppDbContext(options);
            var pending = (await db.Database.GetPendingMigrationsAsync(ct)).ToList();
            if (pending.Count == 0)
            {
                logger.LogInformation("Database schema is up to date");
                return;
            }

            logger.LogInformation("Applying {Count} migration(s): {Migrations}", pending.Count, string.Join(", ", pending));
            await db.Database.MigrateAsync(ct);
            logger.LogInformation("Migrations applied");
        }
        finally
        {
            await using var release = new NpgsqlCommand("SELECT pg_advisory_unlock(@key)", lockConnection);
            release.Parameters.AddWithValue("key", AdvisoryLockKey);
            await release.ExecuteNonQueryAsync(CancellationToken.None);
        }
    }
}
