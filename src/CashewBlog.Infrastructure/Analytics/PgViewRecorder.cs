using CashewBlog.Application.Analytics;
using CashewBlog.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using NpgsqlTypes;

namespace CashewBlog.Infrastructure.Analytics;

/// <summary>
/// One atomic statement: the dedupe upsert only "wins" when no unexpired key exists for this
/// visitor, and the counter/daily-bucket updates run only in that case.
/// </summary>
public sealed class PgViewRecorder(AppDbContext db) : IViewRecorder
{
    private const string Sql = """
        WITH d AS (
            INSERT INTO "PostViewDedupe" ("PostId", "VisitorHash", "ExpiresAt")
            VALUES (@post, @hash, @expires)
            ON CONFLICT ("PostId", "VisitorHash") DO UPDATE SET "ExpiresAt" = EXCLUDED."ExpiresAt"
                WHERE "PostViewDedupe"."ExpiresAt" <= @now
            RETURNING 1
        ), u AS (
            UPDATE "Posts" SET "ViewCount" = "ViewCount" + 1
            WHERE "Id" = @post AND EXISTS (SELECT 1 FROM d)
            RETURNING "ViewCount"
        ), s AS (
            INSERT INTO "PostDailyStats" ("PostId", "Date", "Views")
            SELECT @post, @date, 1 WHERE EXISTS (SELECT 1 FROM d)
            ON CONFLICT ("PostId", "Date") DO UPDATE SET "Views" = "PostDailyStats"."Views" + 1
            RETURNING 1
        )
        SELECT EXISTS (SELECT 1 FROM d) AS "Counted",
               COALESCE((SELECT "ViewCount" FROM u), (SELECT "ViewCount" FROM "Posts" WHERE "Id" = @post), 0) AS "ViewCount",
               (SELECT count(*) FROM s)::int AS "DailyRows"
        """;

    public async Task<(bool Counted, long ViewCount)> RecordAsync(
        Guid postId, string visitorHash, DateOnly date, DateTimeOffset now, TimeSpan window, CancellationToken ct)
    {
        // Not composed further: EF sends the statement as-is (a data-modifying CTE must be top level).
        var rows = await db.Database.SqlQueryRaw<Row>(Sql,
                new NpgsqlParameter("post", NpgsqlDbType.Uuid) { Value = postId },
                new NpgsqlParameter("hash", NpgsqlDbType.Varchar) { Value = visitorHash },
                new NpgsqlParameter("expires", NpgsqlDbType.TimestampTz) { Value = (now + window).UtcDateTime },
                new NpgsqlParameter("now", NpgsqlDbType.TimestampTz) { Value = now.UtcDateTime },
                new NpgsqlParameter("date", NpgsqlDbType.Date) { Value = date })
            .ToListAsync(ct);
        var row = rows.Single();
        return (row.Counted, row.ViewCount);
    }

    public Task<int> PruneExpiredAsync(DateTimeOffset now, CancellationToken ct) =>
        db.PostViewDedupes.Where(d => d.ExpiresAt <= now).ExecuteDeleteAsync(ct);

    private sealed class Row
    {
        public bool Counted { get; set; }
        public long ViewCount { get; set; }
        public int DailyRows { get; set; }
    }
}
