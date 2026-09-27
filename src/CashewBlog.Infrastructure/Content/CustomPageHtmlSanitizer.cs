using AngleSharp.Html.Parser;
using CashewBlog.Application.Abstractions;
using Ganss.Xss;

namespace CashewBlog.Infrastructure.Content;

/// <summary>
/// Custom Page HTML policy (v1): layout/typography markup, images and media are kept together with
/// class/id/style/data-* attributes; scripts, iframes, forms, event handlers and javascript: URLs
/// are removed. Footer HTML is trusted and does NOT go through this sanitizer.
/// </summary>
public sealed class CustomPageHtmlSanitizer : IHtmlSanitizerService
{
    private static readonly string[] ExtraTags =
    [
        "section", "article", "aside", "header", "footer", "nav", "main", "figure", "figcaption",
        "details", "summary", "picture", "source", "video", "audio", "track", "mark", "time",
        "abbr", "kbd", "samp", "var", "sub", "sup", "small", "hr", "wbr", "svg", "path",
    ];

    private static readonly string[] RemovedTags =
    [
        "script", "iframe", "frame", "frameset", "object", "embed", "applet", "form", "input",
        "textarea", "select", "option", "button", "style", "link", "meta", "base",
    ];

    private static readonly string[] ExtraAttributes =
    [
        "class", "id", "style", "role", "title", "target", "rel", "loading", "decoding",
        "controls", "autoplay", "muted", "loop", "playsinline", "poster", "preload", "srcset", "sizes",
        "open", "datetime", "aria-label", "aria-hidden", "aria-describedby", "aria-labelledby",
        "viewbox", "fill", "stroke", "stroke-width", "d", "xmlns", "width", "height",
    ];

    private readonly HtmlSanitizer _sanitizer;

    public CustomPageHtmlSanitizer()
    {
        _sanitizer = new HtmlSanitizer();
        foreach (var tag in ExtraTags)
        {
            _sanitizer.AllowedTags.Add(tag);
        }

        foreach (var tag in RemovedTags)
        {
            _sanitizer.AllowedTags.Remove(tag);
        }

        foreach (var attribute in ExtraAttributes)
        {
            _sanitizer.AllowedAttributes.Add(attribute);
        }

        _sanitizer.AllowDataAttributes = true;
        _sanitizer.AllowedSchemes.Add("mailto");
        _sanitizer.AllowedSchemes.Add("tel");
        _sanitizer.AllowedAtRules.Add(AngleSharp.Css.Dom.CssRuleType.Media);
        _sanitizer.AllowedAtRules.Add(AngleSharp.Css.Dom.CssRuleType.Keyframes);
        _sanitizer.AllowedAtRules.Add(AngleSharp.Css.Dom.CssRuleType.Keyframe);

        // CSS custom properties (var(--x)) are common with the Shirone design tokens.
        _sanitizer.AllowCssCustomProperties = true;
    }

    public string Sanitize(string html) => string.IsNullOrWhiteSpace(html) ? "" : _sanitizer.Sanitize(html);

    public string ToPlainText(string html)
    {
        if (string.IsNullOrWhiteSpace(html))
        {
            return "";
        }

        var document = new HtmlParser().ParseDocument(html);
        return document.Body?.TextContent.Trim() ?? "";
    }
}
