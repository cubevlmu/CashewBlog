using System.Security.Cryptography;

namespace CashewBlog.Domain.Rules;

/// <summary>
/// The admin login entrance: one secret path segment such as <c>/k7x2mq9dfa</c>. Only that address
/// serves the login page; everything else under /admin looks like a missing page to anonymous visitors.
/// </summary>
public static class LoginPathRules
{
    /// <summary>Used when no entrance is configured; not hidden.</summary>
    public const string Default = "/admin/login";

    public const int MinLength = 4;
    public const int MaxLength = 64;

    private const string Alphabet = "abcdefghijkmnpqrstuvwxyz23456789";

    /// <summary>Public-site paths not covered by <see cref="PageSlugRules.ReservedFirstSegments"/>.</summary>
    private static readonly HashSet<string> ExtraReserved = new(StringComparer.OrdinalIgnoreCase)
    {
        "404", "500", "rss", "assets", "images", "logo", "favicon",
    };

    /// <summary>Returns the normalized path (<c>/segment</c>, lower case) or a human-readable error.</summary>
    public static (string Path, string? Error) Normalize(string? input)
    {
        var raw = (input ?? "").Trim().Trim('/').ToLowerInvariant();
        if (raw.Length is < MinLength or > MaxLength || !raw.All(c => char.IsAsciiLetterLower(c) || char.IsAsciiDigit(c) || c is '-' or '_'))
        {
            return ("", $"Use {MinLength}-{MaxLength} letters, digits, '-' or '_' as a single path segment.");
        }

        if (PageSlugRules.ReservedFirstSegments.Contains(raw) || ExtraReserved.Contains(raw))
        {
            return ("", $"'{raw}' is reserved by a system route.");
        }

        return ("/" + raw, null);
    }

    /// <summary>A random 10-character entrance (about 50 bits), without look-alike characters.</summary>
    public static string Generate() =>
        "/" + string.Create(10, 0, (span, _) =>
        {
            for (var i = 0; i < span.Length; i++)
            {
                span[i] = Alphabet[RandomNumberGenerator.GetInt32(Alphabet.Length)];
            }
        });
}
