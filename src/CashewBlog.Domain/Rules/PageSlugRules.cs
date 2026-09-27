namespace CashewBlog.Domain.Rules;

/// <summary>Custom Page slug rules: nested segments allowed, system routes reserved.</summary>
public static class PageSlugRules
{
    public const int MaxDepth = 5;

    /// <summary>First path segments owned by system routes (public site, admin, API, assets).</summary>
    public static readonly IReadOnlySet<string> ReservedFirstSegments = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
    {
        "admin", "api", "setup", "posts", "archive", "categories", "tags", "series",
        "rss.xml", "sitemap.xml", "robots.txt", "uploads", "search", "_astro", "page",
        "health", "favicon.ico",
    };

    /// <summary>
    /// Normalizes each '/'-separated segment with <see cref="SlugGenerator"/>.
    /// Returns null error on success, otherwise a human-readable reason.
    /// </summary>
    public static (string Slug, string? Error) Normalize(string? input)
    {
        if (string.IsNullOrWhiteSpace(input))
        {
            return ("", "Slug is required.");
        }

        var raw = input.Trim().Trim('/');
        // Check the reserved list on the raw first segment too, so "rss.xml" is rejected
        // even though normalization would drop the dot.
        var rawFirst = raw.Split('/', 2)[0].Trim();
        if (ReservedFirstSegments.Contains(rawFirst))
        {
            return ("", $"'{rawFirst}' is reserved by a system route.");
        }

        var segments = raw.Split('/', StringSplitOptions.TrimEntries);
        if (segments.Length > MaxDepth)
        {
            return ("", $"Slug may contain at most {MaxDepth} segments.");
        }

        var normalized = new List<string>(segments.Length);
        foreach (var segment in segments)
        {
            var slug = SlugGenerator.Normalize(segment);
            if (slug.Length == 0)
            {
                return ("", "Slug segments must contain letters or digits.");
            }

            normalized.Add(slug);
        }

        if (ReservedFirstSegments.Contains(normalized[0]))
        {
            return ("", $"'{normalized[0]}' is reserved by a system route.");
        }

        return (string.Join('/', normalized), null);
    }
}
