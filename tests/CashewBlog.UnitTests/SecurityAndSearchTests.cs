using System.Text.Json;
using CashewBlog.Application.Analytics;
using CashewBlog.Application.Common;
using CashewBlog.Application.CustomPages;
using CashewBlog.Application.Search;
using CashewBlog.Application.Settings;
using CashewBlog.Infrastructure.Content;
using CashewBlog.Infrastructure.Media;
using CashewBlog.Infrastructure.Security;

namespace CashewBlog.UnitTests;

public class SnippetBuilderTests
{
    [Fact]
    public void Escapes_content_and_wraps_matches()
    {
        var html = SnippetBuilder.Highlight("Use <script>alert(1)</script> & Search", ["search"]);
        Assert.Equal("Use &lt;script&gt;alert(1)&lt;/script&gt; &amp; <mark>Search</mark>", html);
    }

    [Fact]
    public void Query_text_cannot_inject_markup()
    {
        var html = SnippetBuilder.Highlight("a <b> tag", ["<b>"]);
        Assert.Equal("a <mark>&lt;b&gt;</mark> tag", html);
    }

    [Fact]
    public void Highlights_chinese_terms()
    {
        var html = SnippetBuilder.Highlight("我们在学习数据库索引与全文搜索", ["数据库", "搜索"]);
        Assert.Equal("我们在学习<mark>数据库</mark>索引与全文<mark>搜索</mark>", html);
    }

    [Fact]
    public void Overlapping_matches_are_merged()
    {
        Assert.Equal("<mark>abcd</mark>e", SnippetBuilder.Highlight("abcde", ["abc", "bcd"]));
    }

    [Fact]
    public void Builds_window_around_first_match_with_ellipses()
    {
        var text = new string('a', 300) + " needle " + new string('b', 300);
        var snippet = SnippetBuilder.Build(text, ["needle"], 100);

        Assert.StartsWith("…", snippet);
        Assert.EndsWith("…", snippet);
        Assert.Contains("<mark>needle</mark>", snippet);
    }

    [Fact]
    public void Terms_are_parsed_and_like_wildcards_escaped()
    {
        Assert.Equal(["a", "B"], SearchTerms.Parse("  a   B a "));
        Assert.Equal("100\\%\\_x\\\\", SearchTerms.EscapeLike("100%_x\\"));
    }
}

public class HtmlSanitizerTests
{
    private readonly CustomPageHtmlSanitizer _sanitizer = new();

    [Fact]
    public void Removes_scripts_handlers_and_javascript_urls()
    {
        var html = _sanitizer.Sanitize(
            """<div onclick="evil()"><script>alert(1)</script><a href="javascript:alert(1)">x</a><img src="/uploads/a.png" onerror="evil()"></div>""");

        Assert.DoesNotContain("script", html, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("onclick", html, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("onerror", html, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("javascript:", html, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("src=\"/uploads/a.png\"", html);
    }

    [Fact]
    public void Keeps_layout_markup_and_styling_attributes()
    {
        var html = _sanitizer.Sanitize(
            """<section id="friends" class="grid card" data-columns="3" style="color: red; --gap: 8px"><figure><figcaption>Hi</figcaption></figure><a href="https://example.com" target="_blank" rel="noopener">l</a></section>""");

        Assert.Contains("id=\"friends\"", html);
        Assert.Contains("class=\"grid card\"", html);
        Assert.Contains("data-columns=\"3\"", html);
        Assert.Contains("color:", html);
        Assert.Contains("--gap", html);
        Assert.Contains("<figcaption>", html);
        Assert.Contains("href=\"https://example.com\"", html);
    }

    [Fact]
    public void Removes_iframes_and_forms()
    {
        var html = _sanitizer.Sanitize("""<iframe src="https://x"></iframe><form action="/x"><input name="a"></form><p>ok</p>""");
        Assert.DoesNotContain("iframe", html);
        Assert.DoesNotContain("form", html);
        Assert.Contains("<p>ok</p>", html);
    }

    [Fact]
    public void Custom_css_cannot_close_the_style_element()
    {
        var css = CustomPageService.SanitizeCss(".a{color:red}</style><script>alert(1)</script>");
        Assert.DoesNotContain("</style", css, StringComparison.OrdinalIgnoreCase);
    }
}

public class MarkdownTextTests
{
    [Fact]
    public void Converts_markdown_to_plain_text()
    {
        var text = new MarkdigTextExtractor().ToPlainText("# Title\n\nSome **bold** [link](https://x) and <span>html</span> &amp; `code`.");
        Assert.Contains("Title", text);
        Assert.Contains("Some bold link and", text);
        Assert.Contains("html", text);
        Assert.DoesNotContain("<span>", text);
        Assert.DoesNotContain("**", text);
    }
}

public class VisitorHasherTests
{
    private static readonly byte[] Pepper = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16];

    [Fact]
    public void Same_visitor_same_hash()
    {
        Assert.Equal(VisitorHasher.Hash("1.2.3.4", "UA", Pepper), VisitorHasher.Hash("1.2.3.4", "UA", Pepper));
        Assert.Equal(64, VisitorHasher.Hash("1.2.3.4", "UA", Pepper).Length);
    }

    [Fact]
    public void Different_ip_ua_or_pepper_changes_the_hash()
    {
        var baseline = VisitorHasher.Hash("1.2.3.4", "UA", Pepper);
        Assert.NotEqual(baseline, VisitorHasher.Hash("1.2.3.5", "UA", Pepper));
        Assert.NotEqual(baseline, VisitorHasher.Hash("1.2.3.4", "UA2", Pepper));
        Assert.NotEqual(baseline, VisitorHasher.Hash("1.2.3.4", "UA", [9, 9, 9]));
    }

    [Fact]
    public void Dedupe_window_is_thirty_minutes() => Assert.Equal(TimeSpan.FromMinutes(30), VisitorHasher.DedupeWindow);
}

public class PasswordHasherTests
{
    [Fact]
    public void Round_trips_and_rejects_wrong_password()
    {
        var hasher = new Argon2PasswordHasher();
        var hash = hasher.Hash("correct horse battery");

        Assert.StartsWith("$argon2id$v=19$m=", hash);
        Assert.True(hasher.Verify("correct horse battery", hash));
        Assert.False(hasher.Verify("wrong", hash));
        Assert.False(hasher.Verify("correct horse battery", "not-a-hash"));
    }
}

public class StoragePathTests
{
    [Theory]
    [InlineData("2026/09/a.webp", true)]
    [InlineData("../secret.txt", false)]
    [InlineData("2026/../../x", false)]
    [InlineData("C:/Windows/win.ini", false)]
    [InlineData("a\0b", false)]
    [InlineData("", false)]
    public void Resolves_only_inside_root(string relative, bool allowed)
    {
        var root = Path.Combine(Path.GetTempPath(), "cashewblog-root");
        var resolved = LocalMediaStorage.ResolveUnder(root, relative);
        Assert.Equal(allowed, resolved is not null);
    }
}

public class SettingsValidationTests
{
    [Fact]
    public void Defaults_are_valid() => SettingsService.Validate(new SiteSettings());

    [Fact]
    public void Navigation_deeper_than_two_levels_is_rejected()
    {
        var leaf = new NavItem { Id = "c", Label = "C", Type = NavItemType.Url, Target = "https://x" };
        var child = new NavItem { Id = "b", Label = "B", Type = NavItemType.Url, Target = "/b", Children = [leaf] };
        var root = new NavItem { Id = "a", Label = "A", Type = NavItemType.Url, Target = "/a", Children = [child] };
        var settings = new SiteSettings { Navigation = [root] };

        var ex = Assert.Throws<ValidationException>(() => SettingsService.Validate(settings));
        Assert.Contains("navigation[0].children[0].children", ex.Errors.Keys);
    }

    [Fact]
    public void Out_of_range_values_are_rejected()
    {
        var settings = new SiteSettings
        {
            Appearance = new AppearanceSettings { ThemeHue = 400 },
            Article = new ArticleSettings { PageSize = 0 },
        };

        var ex = Assert.Throws<ValidationException>(() => SettingsService.Validate(settings));
        Assert.Contains("appearance.themeHue", ex.Errors.Keys);
        Assert.Contains("article.pageSize", ex.Errors.Keys);
    }

    [Fact]
    public void Unknown_enum_values_fail_deserialization()
    {
        Assert.Throws<JsonException>(() =>
            JsonSerializer.Deserialize<SiteSettings>("""{"appearance":{"themeStyle":"sparkly"}}""", AppJson.Options));
    }

    [Fact]
    public void Missing_properties_keep_defaults_and_enums_are_camel_case()
    {
        var settings = SettingsService.Deserialize("""{"general":{"siteName":"X"}}""", 1);
        Assert.Equal("X", settings.General.SiteName);
        Assert.Equal("zh-CN", settings.General.Language);

        var json = SettingsService.Serialize(settings);
        Assert.Contains("\"themeStyle\":\"tonalSpot\"", json);
        Assert.Contains("\"schemaVersion\":1", json);
    }
}
