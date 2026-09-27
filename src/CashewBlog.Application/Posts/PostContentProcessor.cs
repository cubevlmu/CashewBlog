using System.Globalization;
using System.Text;
using CashewBlog.Application.Abstractions;
using CashewBlog.Domain.Entities;
using CashewBlog.Domain.Rules;

namespace CashewBlog.Application.Posts;

/// <summary>Computes the derived columns of a post (SearchText, Excerpt, WordCount).</summary>
public sealed class PostContentProcessor(IMarkdownTextExtractor markdown)
{
    /// <summary>Separates the header (title/tags/description) from the body inside SearchText.</summary>
    public const char BodySeparator = '\u001F';

    public const int ExcerptLength = 160;

    public void Refresh(Post post, IEnumerable<string> tagNames)
    {
        var body = markdown.ToPlainText(post.ContentMarkdown);
        post.WordCount = WordCounter.Count(body);
        post.Excerpt = BuildExcerpt(body, ExcerptLength);
        post.SearchText = BuildHeader(post.Title, tagNames, post.Description) + BodySeparator + body;
    }

    /// <summary>Rebuilds only the header part (title/tags/description), reusing the stored body text.</summary>
    public static void RefreshHeader(Post post, IEnumerable<string> tagNames)
    {
        var index = post.SearchText.IndexOf(BodySeparator);
        var body = index >= 0 ? post.SearchText[(index + 1)..] : post.SearchText;
        post.SearchText = BuildHeader(post.Title, tagNames, post.Description) + BodySeparator + body;
    }

    /// <summary>The body part of SearchText (used for search snippets).</summary>
    public static string BodyOf(string searchText)
    {
        var index = searchText.IndexOf(BodySeparator);
        return index >= 0 ? searchText[(index + 1)..] : searchText;
    }

    private static string BuildHeader(string title, IEnumerable<string> tags, string? description) =>
        $"{title}\n{string.Join(' ', tags)}\n{description}";

    /// <summary>Collapses whitespace and truncates on a text-element boundary, appending an ellipsis.</summary>
    public static string BuildExcerpt(string plainText, int maxLength)
    {
        var collapsed = CollapseWhitespace(plainText);
        var info = new StringInfo(collapsed);
        if (info.LengthInTextElements <= maxLength)
        {
            return collapsed;
        }

        return info.SubstringByTextElements(0, maxLength).TrimEnd() + "…";
    }

    public static string CollapseWhitespace(string text)
    {
        var sb = new StringBuilder(text.Length);
        var pendingSpace = false;
        foreach (var ch in text)
        {
            if (char.IsWhiteSpace(ch) || ch == BodySeparator)
            {
                pendingSpace = sb.Length > 0;
                continue;
            }

            if (pendingSpace)
            {
                sb.Append(' ');
                pendingSpace = false;
            }

            sb.Append(ch);
        }

        return sb.ToString();
    }
}
