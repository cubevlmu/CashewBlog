using System.Text;
using CashewBlog.Application.Posts;

namespace CashewBlog.Application.Search;

public sealed record SearchResultItem(
    Guid Id,
    string Slug,
    string Url,
    string Title,
    // HTML-escaped title with matches wrapped in <mark>.
    string TitleHtml,
    // HTML-escaped excerpt around the first body match, matches wrapped in <mark>.
    string SnippetHtml,
    // Names of the post's tags that contain a search term.
    IReadOnlyList<string> MatchedTags,
    IReadOnlyList<TermRef> Tags,
    TermRef? Category,
    CoverDto? Cover,
    DateTimeOffset? PublishedAt,
    double Score);

public sealed record SearchResultDto(string Query, IReadOnlyList<SearchResultItem> Items, int Page, int PageSize, int TotalItems)
{
    public int TotalPages => PageSize <= 0 ? 0 : (int)Math.Ceiling(TotalItems / (double)PageSize);
}

/// <summary>Full-text-ish search over Published posts (pg_trgm + ILIKE). Implemented in Infrastructure.</summary>
public interface ISearchService
{
    Task<SearchResultDto> SearchAsync(string? query, int? page, int? pageSize, CancellationToken ct);
}

public static class SearchTerms
{
    public const int MaxTerms = 8;
    public const int MaxTermLength = 64;

    /// <summary>Splits a query on whitespace into distinct, length-capped terms.</summary>
    public static IReadOnlyList<string> Parse(string? query)
    {
        if (string.IsNullOrWhiteSpace(query))
        {
            return [];
        }

        return query.Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Select(t => t.Length > MaxTermLength ? t[..MaxTermLength] : t)
            .DistinctBy(t => t.ToLowerInvariant())
            .Take(MaxTerms)
            .ToList();
    }

    /// <summary>Escapes LIKE wildcards so user input is matched literally (escape char '\').</summary>
    public static string EscapeLike(string term) =>
        term.Replace("\\", "\\\\").Replace("%", "\\%").Replace("_", "\\_");
}

/// <summary>
/// Builds safe highlighted HTML: source text is HTML-escaped piecewise and only our own
/// &lt;mark&gt; tags are inserted, so neither content nor query can inject markup.
/// </summary>
public static class SnippetBuilder
{
    public static string Escape(string text)
    {
        var sb = new StringBuilder(text.Length + 16);
        foreach (var ch in text)
        {
            sb.Append(ch switch
            {
                '&' => "&amp;",
                '<' => "&lt;",
                '>' => "&gt;",
                '"' => "&quot;",
                '\'' => "&#39;",
                _ => ch.ToString(),
            });
        }

        return sb.ToString();
    }

    /// <summary>Highlights every occurrence of the terms in the whole text.</summary>
    public static string Highlight(string text, IReadOnlyList<string> terms) => Render(text, 0, text.Length, terms);

    /// <summary>
    /// Returns a window of about <paramref name="maxLength"/> characters around the first
    /// match (or the start of the text when nothing matches), with matches highlighted.
    /// </summary>
    public static string Build(string text, IReadOnlyList<string> terms, int maxLength = 160)
    {
        text = PostContentProcessor.CollapseWhitespace(text);
        if (text.Length == 0)
        {
            return "";
        }

        var first = -1;
        foreach (var term in terms)
        {
            var index = text.IndexOf(term, StringComparison.OrdinalIgnoreCase);
            if (index >= 0 && (first < 0 || index < first))
            {
                first = index;
            }
        }

        var start = first <= 0 ? 0 : Math.Max(0, first - maxLength / 4);
        var end = Math.Min(text.Length, start + maxLength);
        if (end == text.Length)
        {
            start = Math.Max(0, end - maxLength);
        }

        // Don't split surrogate pairs.
        if (start > 0 && char.IsLowSurrogate(text[start]))
        {
            start--;
        }

        if (end < text.Length && char.IsLowSurrogate(text[end]))
        {
            end++;
        }

        var body = Render(text, start, end, terms);
        return (start > 0 ? "…" : "") + body + (end < text.Length ? "…" : "");
    }

    private static string Render(string text, int start, int end, IReadOnlyList<string> terms)
    {
        // Collect match ranges inside [start, end), then merge overlaps.
        var ranges = new List<(int Start, int End)>();
        foreach (var term in terms.Where(t => t.Length > 0))
        {
            var index = start;
            while (index < end)
            {
                var found = text.IndexOf(term, index, end - index, StringComparison.OrdinalIgnoreCase);
                if (found < 0)
                {
                    break;
                }

                ranges.Add((found, Math.Min(end, found + term.Length)));
                index = found + term.Length;
            }
        }

        ranges.Sort((a, b) => a.Start.CompareTo(b.Start));
        var merged = new List<(int Start, int End)>();
        foreach (var range in ranges)
        {
            if (merged.Count > 0 && range.Start <= merged[^1].End)
            {
                merged[^1] = (merged[^1].Start, Math.Max(merged[^1].End, range.End));
            }
            else
            {
                merged.Add(range);
            }
        }

        var sb = new StringBuilder();
        var cursor = start;
        foreach (var (s, e) in merged)
        {
            sb.Append(Escape(text[cursor..s]));
            sb.Append("<mark>").Append(Escape(text[s..e])).Append("</mark>");
            cursor = e;
        }

        sb.Append(Escape(text[cursor..end]));
        return sb.ToString();
    }
}
