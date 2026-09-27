using CashewBlog.Application.Common;
using CashewBlog.Application.Posts;
using CashewBlog.Application.Search;
using CashewBlog.Domain.Entities;
using CashewBlog.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using NpgsqlTypes;

namespace CashewBlog.Infrastructure.Search;

/// <summary>
/// PostgreSQL search over Published posts. Candidates: every term must appear (ILIKE) in
/// SearchText (title + tags + description + body), or the whole query is trigram-similar to the
/// title (typo tolerance). Ranking, highest first:
///   exact title (100) &gt; title prefix (60) &gt; all terms in title (40)
///   + title similarity × 30 + tag match 20 + all terms in text 10 + word similarity × 5
///   + a tiny recency term used only as a tie-breaker.
/// ILIKE works for CJK text regardless of locale; the pg_trgm GIN indexes accelerate it.
/// </summary>
public sealed class PgSearchService(AppDbContext db) : ISearchService
{
    private const string Candidates = """
        FROM "Posts" p
        WHERE p."Status" = 1 AND p."DeletedAt" IS NULL
          AND (p."SearchText" ILIKE ALL (@patterns) OR @q % p."Title")
        """;

    private const string RankSql = """
        SELECT p."Id" AS "Id",
          (CASE WHEN lower(p."Title") = lower(@q) THEN 100.0
                WHEN p."Title" ILIKE @prefix THEN 60.0
                WHEN p."Title" ILIKE ALL (@patterns) THEN 40.0
                ELSE 0.0 END
           + similarity(p."Title", @q) * 30.0
           + CASE WHEN EXISTS (
                 SELECT 1 FROM "PostTags" pt JOIN "Tags" t ON t."Id" = pt."TagId"
                 WHERE pt."PostId" = p."Id" AND t."Name" ILIKE ANY (@patterns)) THEN 20.0 ELSE 0.0 END
           + CASE WHEN p."SearchText" ILIKE ALL (@patterns) THEN 10.0 ELSE 0.0 END
           + word_similarity(@q, p."SearchText") * 5.0
           + COALESCE(EXTRACT(EPOCH FROM p."PublishedAt"), 0) / 1e11
          )::double precision AS "Score"
        """;

    private const string NewLine = "\n";

    private const string CountSql = """SELECT count(*)::int AS "Value" """ + NewLine + Candidates;

    private const string PageSql = RankSql + NewLine + Candidates + NewLine
        + """ORDER BY "Score" DESC, p."PublishedAt" DESC LIMIT @limit OFFSET @offset""";

    public async Task<SearchResultDto> SearchAsync(string? query, int? page, int? pageSize, CancellationToken ct)
    {
        var (p, size) = Paging.Normalize(page, pageSize, 10, 50);
        var terms = SearchTerms.Parse(query);
        var normalizedQuery = string.Join(' ', terms);
        if (terms.Count == 0)
        {
            return new SearchResultDto("", [], p, size, 0);
        }

        var patterns = terms.Select(t => $"%{SearchTerms.EscapeLike(t)}%").ToArray();
        var prefix = SearchTerms.EscapeLike(normalizedQuery) + "%";

        var total = (await db.Database
            .SqlQueryRaw<int>(CountSql, Parameters(normalizedQuery, patterns, prefix))
            .ToListAsync(ct)).Single();
        if (total == 0)
        {
            return new SearchResultDto(normalizedQuery, [], p, size, 0);
        }

        var hits = await db.Database
            .SqlQueryRaw<SearchHit>(
                PageSql,
                [
                    .. Parameters(normalizedQuery, patterns, prefix),
                    new NpgsqlParameter("limit", NpgsqlDbType.Integer) { Value = size },
                    new NpgsqlParameter("offset", NpgsqlDbType.Integer) { Value = (p - 1) * size },
                ])
            .ToListAsync(ct);

        var ids = hits.Select(h => h.Id).ToList();
        var rows = await db.Posts.AsNoTracking()
            .Where(x => ids.Contains(x.Id) && x.Status == PostStatus.Published)
            .Select(PostProjections.Row)
            .ToListAsync(ct);
        var texts = await db.Posts.AsNoTracking()
            .Where(x => ids.Contains(x.Id))
            .Select(x => new { x.Id, x.SearchText })
            .ToDictionaryAsync(x => x.Id, x => x.SearchText, ct);

        var items = new List<SearchResultItem>(hits.Count);
        foreach (var hit in hits)
        {
            var row = rows.FirstOrDefault(r => r.Id == hit.Id);
            if (row is null)
            {
                continue;
            }

            var summary = row.ToSummary();
            var body = PostContentProcessor.BodyOf(texts.GetValueOrDefault(hit.Id, ""));
            var matchedTags = summary.Tags
                .Where(t => terms.Any(term => t.Name.Contains(term, StringComparison.OrdinalIgnoreCase)))
                .Select(t => t.Name)
                .ToList();
            items.Add(new SearchResultItem(
                summary.Id,
                summary.Slug,
                $"/posts/{Uri.EscapeDataString(summary.Slug)}",
                summary.Title,
                SnippetBuilder.Highlight(summary.Title, terms),
                SnippetBuilder.Build(body.Length > 0 ? body : summary.Description, terms),
                matchedTags,
                summary.Tags,
                summary.Category,
                summary.Cover,
                summary.PublishedAt,
                Math.Round(hit.Score, 4)));
        }

        return new SearchResultDto(normalizedQuery, items, p, size, total);
    }

    private static object[] Parameters(string q, string[] patterns, string prefix) =>
    [
        new NpgsqlParameter("q", NpgsqlDbType.Text) { Value = q },
        new NpgsqlParameter("patterns", NpgsqlDbType.Array | NpgsqlDbType.Text) { Value = patterns },
        new NpgsqlParameter("prefix", NpgsqlDbType.Text) { Value = prefix },
    ];

    private sealed class SearchHit
    {
        public Guid Id { get; set; }
        public double Score { get; set; }
    }
}
