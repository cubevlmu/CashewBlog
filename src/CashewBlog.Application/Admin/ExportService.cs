using System.Globalization;
using System.IO.Compression;
using System.Text;
using CashewBlog.Application.Abstractions;
using CashewBlog.Application.Media;
using Microsoft.EntityFrameworkCore;

namespace CashewBlog.Application.Admin;

/// <summary>Backup exports: settings JSON and a ZIP of Markdown posts. Media is not included (use the uploads volume / pg_dump).</summary>
public sealed class ExportService(IApplicationDbContext db)
{
    /// <summary>
    /// Writes <c>posts/{slug}.md</c> (YAML front matter + Markdown body) for every post that is not
    /// in the trash, plus <c>pages/{slug}.html</c> for custom pages.
    /// </summary>
    public async Task WritePostsZipAsync(Stream output, CancellationToken ct)
    {
        var posts = await db.Posts.AsNoTracking()
            .Include(p => p.Category)
            .Include(p => p.Series)
            .Include(p => p.CoverMedia)
            .Include(p => p.PostTags).ThenInclude(pt => pt.Tag)
            .AsSplitQuery()
            .OrderBy(p => p.CreatedAt)
            .ToListAsync(ct);
        var pages = await db.CustomPages.AsNoTracking().OrderBy(p => p.Slug).ToListAsync(ct);

        using var zip = new ZipArchive(output, ZipArchiveMode.Create, leaveOpen: true);
        foreach (var post in posts)
        {
            var sb = new StringBuilder("---\n");
            Yaml(sb, "title", post.Title);
            Yaml(sb, "slug", post.Slug);
            Yaml(sb, "status", post.Status.ToString().ToLowerInvariant());
            Yaml(sb, "description", post.Description);
            Yaml(sb, "category", post.Category?.Name);
            sb.Append("tags: [");
            sb.Append(string.Join(", ", post.PostTags.Select(pt => Quote(pt.Tag.Name))));
            sb.Append("]\n");
            Yaml(sb, "series", post.Series?.Title);
            if (post.SeriesOrder is { } order)
            {
                sb.Append("seriesOrder: ").Append(order.ToString(CultureInfo.InvariantCulture)).Append('\n');
            }

            sb.Append("pinned: ").Append(post.IsPinned ? "true" : "false").Append('\n');
            Yaml(sb, "cover", post.CoverMedia is null ? null : MediaUrls.For(post.CoverMedia.OptimizedPath ?? post.CoverMedia.OriginalPath));
            Yaml(sb, "seoTitle", post.SeoTitle);
            Yaml(sb, "seoDescription", post.SeoDescription);
            Yaml(sb, "createdAt", post.CreatedAt.ToString("O", CultureInfo.InvariantCulture));
            Yaml(sb, "updatedAt", post.UpdatedAt.ToString("O", CultureInfo.InvariantCulture));
            Yaml(sb, "publishedAt", post.PublishedAt?.ToString("O", CultureInfo.InvariantCulture));
            sb.Append("views: ").Append(post.ViewCount.ToString(CultureInfo.InvariantCulture)).Append('\n');
            sb.Append("---\n\n").Append(post.ContentMarkdown);
            if (!post.ContentMarkdown.EndsWith('\n'))
            {
                sb.Append('\n');
            }

            await WriteEntryAsync(zip, $"posts/{SafeFileName(post.Slug)}.md", sb.ToString(), ct);
        }

        foreach (var page in pages)
        {
            var html = new StringBuilder()
                .Append("<!-- title: ").Append(page.Title.Replace("--", "- -")).Append(" -->\n")
                .Append("<!-- layout: ").Append(page.Layout.ToString()).Append(" -->\n");
            if (!string.IsNullOrEmpty(page.CustomCss))
            {
                html.Append("<style>\n").Append(page.CustomCss).Append("\n</style>\n");
            }

            html.Append(page.ContentHtml);
            await WriteEntryAsync(zip, $"pages/{SafeFileName(page.Slug.Replace('/', '_'))}.html", html.ToString(), ct);
        }
    }

    private static async Task WriteEntryAsync(ZipArchive zip, string name, string content, CancellationToken ct)
    {
        var entry = zip.CreateEntry(name, CompressionLevel.Optimal);
        await using var stream = entry.Open();
        var bytes = new UTF8Encoding(false).GetBytes(content);
        await stream.WriteAsync(bytes, ct);
    }

    private static void Yaml(StringBuilder sb, string key, string? value)
    {
        if (value is null)
        {
            return;
        }

        sb.Append(key).Append(": ").Append(Quote(value)).Append('\n');
    }

    /// <summary>YAML double-quoted scalar.</summary>
    public static string Quote(string value)
    {
        var sb = new StringBuilder("\"");
        foreach (var ch in value)
        {
            sb.Append(ch switch
            {
                '"' => "\\\"",
                '\\' => "\\\\",
                '\n' => "\\n",
                '\r' => "\\r",
                '\t' => "\\t",
                _ when char.IsControl(ch) => $"\\u{(int)ch:x4}",
                _ => ch.ToString(),
            });
        }

        return sb.Append('"').ToString();
    }

    private static string SafeFileName(string slug)
    {
        var invalid = Path.GetInvalidFileNameChars();
        var cleaned = new string(slug.Select(c => invalid.Contains(c) ? '_' : c).ToArray());
        return cleaned.Length == 0 ? "untitled" : cleaned;
    }
}
