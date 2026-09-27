using CashewBlog.Application.Media;
using CashewBlog.Application.Posts;
using CashewBlog.Domain.Rules;

namespace CashewBlog.UnitTests;

public class SlugGeneratorTests
{
    [Theory]
    [InlineData("Hello World", "hello-world")]
    [InlineData("你好 世界", "你好-世界")]
    [InlineData("C# & .NET: Tips?", "c-net-tips")]
    [InlineData("  --a__b--  ", "a-b")]
    [InlineData("Ünïcödé Straße", "ünïcödé-straße")]
    [InlineData("a/b?c#d[e]f@g!h$i&j'k(l)m*n+o,p;q=r%s", "abcdefghijklmnopqrs")]
    [InlineData("日本語のタイトル 2026", "日本語のタイトル-2026")]
    [InlineData("🎉 party", "party")]
    [InlineData("", "")]
    [InlineData("???", "")]
    public void Normalize(string input, string expected) => Assert.Equal(expected, SlugGenerator.Normalize(input));

    [Fact]
    public void FromTitle_falls_back_when_nothing_usable()
    {
        Assert.Equal("my-slug", SlugGenerator.FromTitle("My Slug", "Title"));
        Assert.Equal("title", SlugGenerator.FromTitle(null, "Title"));
        Assert.Equal("post", SlugGenerator.FromTitle("", "!!!"));
    }

    [Fact]
    public void MakeUnique_appends_numeric_suffix()
    {
        Assert.Equal("a", SlugGenerator.MakeUnique("a", new HashSet<string>()));
        Assert.Equal("a-2", SlugGenerator.MakeUnique("a", new HashSet<string> { "a" }));
        Assert.Equal("a-4", SlugGenerator.MakeUnique("a", new HashSet<string> { "a", "a-2", "a-3" }));
    }

    [Fact]
    public void Long_slugs_are_truncated()
    {
        var slug = SlugGenerator.Normalize(new string('x', 500));
        Assert.Equal(SlugGenerator.MaxLength, slug.Length);
    }
}

public class PageSlugRulesTests
{
    [Theory]
    [InlineData("links/friends", "links/friends")]
    [InlineData("/About Me/", "about-me")]
    [InlineData("关于/友链", "关于/友链")]
    public void Accepts_nested_slugs(string input, string expected)
    {
        var (slug, error) = PageSlugRules.Normalize(input);
        Assert.Null(error);
        Assert.Equal(expected, slug);
    }

    [Theory]
    [InlineData("admin")]
    [InlineData("API/things")]
    [InlineData("posts/x")]
    [InlineData("rss.xml")]
    [InlineData("robots.txt")]
    [InlineData("_astro")]
    [InlineData("uploads/a")]
    [InlineData("search")]
    [InlineData("page")]
    [InlineData("a//b")]
    [InlineData("")]
    [InlineData("../etc")]
    public void Rejects_reserved_or_invalid(string input)
    {
        var (_, error) = PageSlugRules.Normalize(input);
        Assert.NotNull(error);
    }
}

public class WordCounterTests
{
    [Theory]
    [InlineData("", 0)]
    [InlineData("Hello world", 2)]
    [InlineData("你好世界", 4)]
    [InlineData("Hello 世界, it's 2026!", 5)]
    [InlineData("こんにちは", 5)]
    [InlineData("state-of-the-art", 4)]
    public void Counts_cjk_characters_and_latin_words(string text, int expected) =>
        Assert.Equal(expected, WordCounter.Count(text));
}

public class ExcerptTests
{
    [Fact]
    public void Collapses_whitespace_and_truncates()
    {
        var excerpt = PostContentProcessor.BuildExcerpt("a  b\n\nc " + new string('x', 300), 10);
        Assert.StartsWith("a b c", excerpt);
        Assert.EndsWith("…", excerpt);
        Assert.Equal(11, excerpt.Length);
    }

    [Fact]
    public void Search_header_can_be_rebuilt_without_touching_the_body()
    {
        var post = new CashewBlog.Domain.Entities.Post { Title = "Old", SearchText = "Old\nt1\n" + PostContentProcessor.BodySeparator + "body text" };
        post.Title = "New";

        PostContentProcessor.RefreshHeader(post, ["t2"]);

        Assert.Equal("body text", PostContentProcessor.BodyOf(post.SearchText));
        Assert.StartsWith("New\nt2\n", post.SearchText);
    }
}

public class MediaRulesTests
{
    [Fact]
    public void Extracts_asset_ids_from_upload_urls()
    {
        var id1 = Guid.CreateVersion7();
        var id2 = Guid.CreateVersion7();
        var markdown = $"![a](/uploads/2026/09/{id1}-display.webp) [f](https://blog.example/uploads/2026/10/{id2}.zip) /uploads/bad/{Guid.NewGuid()}";

        var ids = MediaReferenceTracker.ExtractAssetIds(markdown).ToList();

        Assert.Equal([id1, id2], ids);
    }

    [Theory]
    [InlineData(4000, 3000, 2560, 1920)]
    [InlineData(1000, 800, 1000, 800)]
    [InlineData(1000, 5120, 500, 2560)]
    public void Display_dimensions_cap_the_long_edge(int w, int h, int ew, int eh) =>
        Assert.Equal(((int?)ew, (int?)eh), MediaDimensions.Display(w, h));

    [Theory]
    [InlineData("report.PDF", ".pdf")]
    [InlineData("archive.tar.gz", ".gz")]
    [InlineData("noext", "")]
    [InlineData("weird.p$p", "")]
    public void Safe_extension(string name, string expected) => Assert.Equal(expected, MediaService.SafeExtension(name));
}
