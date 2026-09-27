using System.Globalization;
using System.Text;

namespace CashewBlog.Domain.Rules;

/// <summary>
/// Produces URL slugs. Unicode letters (including CJK) are kept as-is; Latin letters are
/// lower-cased; whitespace and underscores become '-'; URL-reserved characters and other
/// punctuation are stripped; consecutive dashes collapse.
/// </summary>
public static class SlugGenerator
{
    public const int MaxLength = 120;

    public static string Normalize(string? input)
    {
        if (string.IsNullOrWhiteSpace(input))
        {
            return "";
        }

        var text = input.Normalize(NormalizationForm.FormKC).Trim();
        var sb = new StringBuilder(text.Length);
        var lastWasDash = false;

        foreach (var rune in text.EnumerateRunes())
        {
            if (Rune.IsWhiteSpace(rune) || rune.Value is '_' or '-')
            {
                if (!lastWasDash && sb.Length > 0)
                {
                    sb.Append('-');
                    lastWasDash = true;
                }

                continue;
            }

            var keep = Rune.GetUnicodeCategory(rune) is UnicodeCategory.UppercaseLetter
                or UnicodeCategory.LowercaseLetter or UnicodeCategory.TitlecaseLetter
                or UnicodeCategory.ModifierLetter or UnicodeCategory.OtherLetter
                or UnicodeCategory.DecimalDigitNumber or UnicodeCategory.LetterNumber
                or UnicodeCategory.OtherNumber or UnicodeCategory.NonSpacingMark
                or UnicodeCategory.SpacingCombiningMark;

            // Everything else (/?#[]@!$&'()*+,;=%"<>\^`{|}, '.', symbols, emoji) is dropped.
            // Dropping '.' also rules out '.' and '..' path segments.
            if (!keep)
            {
                continue;
            }

            sb.Append(Rune.ToLowerInvariant(rune).ToString());
            lastWasDash = false;
        }

        var result = sb.ToString().Trim('-');
        if (result.Length > MaxLength)
        {
            result = result[..MaxLength];
            if (char.IsHighSurrogate(result[^1]))
            {
                result = result[..^1];
            }

            result = result.TrimEnd('-');
        }

        return result;
    }

    /// <summary>Normalizes <paramref name="preferred"/>, falling back to the title, then to <paramref name="fallback"/>.</summary>
    public static string FromTitle(string? preferred, string? title, string fallback = "post")
    {
        var slug = Normalize(preferred);
        if (slug.Length == 0)
        {
            slug = Normalize(title);
        }

        return slug.Length == 0 ? fallback : slug;
    }

    /// <summary>Returns <paramref name="baseSlug"/> or the first free <c>{baseSlug}-N</c> (N ≥ 2).</summary>
    public static string MakeUnique(string baseSlug, ISet<string> taken)
    {
        if (!taken.Contains(baseSlug))
        {
            return baseSlug;
        }

        for (var i = 2; ; i++)
        {
            var candidate = $"{baseSlug}-{i}";
            if (!taken.Contains(candidate))
            {
                return candidate;
            }
        }
    }
}
