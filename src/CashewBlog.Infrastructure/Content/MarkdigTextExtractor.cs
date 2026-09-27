using System.Net;
using System.Text.RegularExpressions;
using CashewBlog.Application.Abstractions;
using Markdig;

namespace CashewBlog.Infrastructure.Content;

/// <summary>
/// Markdown → plain text via Markdig. Used for search text, excerpts and word counts only;
/// public rendering is done by the Astro frontend.
/// </summary>
public sealed partial class MarkdigTextExtractor : IMarkdownTextExtractor
{
    private static readonly MarkdownPipeline Pipeline = new MarkdownPipelineBuilder()
        .UseAdvancedExtensions()
        .UseYamlFrontMatter()
        .Build();

    [GeneratedRegex("<[^>]*>", RegexOptions.CultureInvariant)]
    private static partial Regex TagRegex();

    public string ToPlainText(string markdown)
    {
        if (string.IsNullOrWhiteSpace(markdown))
        {
            return "";
        }

        var text = Markdown.ToPlainText(markdown, Pipeline);

        // Raw HTML inside Markdown survives as text; strip tags and decode entities.
        text = TagRegex().Replace(text, " ");
        return WebUtility.HtmlDecode(text).Trim();
    }
}
