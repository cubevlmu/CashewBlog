using System.Text.RegularExpressions;
using CashewBlog.Application.Abstractions;
using CashewBlog.Application.Common;
using CashewBlog.Application.Media;
using CashewBlog.Domain.Entities;
using CashewBlog.Domain.Rules;
using Microsoft.EntityFrameworkCore;

namespace CashewBlog.Application.CustomPages;

public sealed record CustomPageDto(
    Guid Id, string Title, string Slug, string ContentHtml, string? CustomCss, PageLayout Layout,
    DateTimeOffset CreatedAt, DateTimeOffset UpdatedAt);

public sealed record CustomPageListItemDto(Guid Id, string Title, string Slug, PageLayout Layout, DateTimeOffset CreatedAt, DateTimeOffset UpdatedAt);

public sealed record PublicCustomPageDto(string Title, string Slug, string ContentHtml, string? CustomCss, PageLayout Layout, DateTimeOffset CreatedAt, DateTimeOffset UpdatedAt);

public sealed record UpsertCustomPageRequest(string? Title, string? Slug, string? ContentHtml, string? CustomCss, PageLayout? Layout);

public sealed partial class CustomPageService(IApplicationDbContext db, IClock clock, IHtmlSanitizerService sanitizer, IPublicCache cache)
{
    public Task<List<CustomPageListItemDto>> ListAsync(CancellationToken ct) =>
        db.CustomPages.AsNoTracking().OrderBy(p => p.Slug)
            .Select(p => new CustomPageListItemDto(p.Id, p.Title, p.Slug, p.Layout, p.CreatedAt, p.UpdatedAt))
            .ToListAsync(ct);

    public async Task<CustomPageDto> GetAsync(Guid id, CancellationToken ct) =>
        ToDto(await db.CustomPages.AsNoTracking().FirstOrDefaultAsync(p => p.Id == id, ct) ?? throw new NotFoundException("Page not found."));

    public async Task<PublicCustomPageDto?> GetPublicAsync(string slug, CancellationToken ct)
    {
        var normalized = slug.Trim('/');
        var page = await db.CustomPages.AsNoTracking().FirstOrDefaultAsync(p => p.Slug == normalized, ct);
        return page is null ? null : new PublicCustomPageDto(page.Title, page.Slug, page.ContentHtml, page.CustomCss, page.Layout, page.CreatedAt, page.UpdatedAt);
    }

    public async Task<CustomPageDto> CreateAsync(UpsertCustomPageRequest request, CancellationToken ct)
    {
        var now = clock.UtcNow;
        var page = new CustomPage { CreatedAt = now };
        await ApplyAsync(page, request, ct);
        db.CustomPages.Add(page);
        await SaveAsync(page, ct);
        return ToDto(page);
    }

    public async Task<CustomPageDto> UpdateAsync(Guid id, UpsertCustomPageRequest request, CancellationToken ct)
    {
        var page = await db.CustomPages.FirstOrDefaultAsync(p => p.Id == id, ct) ?? throw new NotFoundException("Page not found.");
        await ApplyAsync(page, request, ct);
        await SaveAsync(page, ct);
        return ToDto(page);
    }

    public async Task DeleteAsync(Guid id, CancellationToken ct)
    {
        var page = await db.CustomPages.FirstOrDefaultAsync(p => p.Id == id, ct) ?? throw new NotFoundException("Page not found.");
        db.CustomPages.Remove(page);
        await MediaReferenceTracker.RemoveOwnerAsync(db, MediaOwnerType.CustomPage, id, ct);
        await db.SaveChangesAsync(ct);
        cache.Invalidate();
    }

    private async Task ApplyAsync(CustomPage page, UpsertCustomPageRequest request, CancellationToken ct)
    {
        var errors = new ValidationErrors();
        var title = request.Title?.Trim() ?? "";
        errors.Require(title.Length is > 0 and <= 200, "title", "Title is required (max 200 characters).");

        var (slug, slugError) = PageSlugRules.Normalize(string.IsNullOrWhiteSpace(request.Slug) ? title : request.Slug);
        if (slugError is not null)
        {
            errors.Add("slug", slugError);
        }
        else if (await db.CustomPages.AnyAsync(p => p.Slug == slug && p.Id != page.Id, ct))
        {
            errors.Add("slug", "Another page already uses this slug.");
        }

        errors.ThrowIfAny();

        page.Title = title;
        page.Slug = slug;
        page.ContentHtml = sanitizer.Sanitize(request.ContentHtml ?? "");
        page.CustomCss = SanitizeCss(request.CustomCss);
        page.Layout = request.Layout ?? PageLayout.Default;
        page.UpdatedAt = clock.UtcNow;
    }

    [GeneratedRegex("</\\s*style", RegexOptions.IgnoreCase | RegexOptions.CultureInvariant)]
    private static partial Regex StyleCloseRegex();

    /// <summary>
    /// CSS is allowed as-is (it is rendered inside a &lt;style&gt; element scoped by the frontend),
    /// but must not be able to close that element and inject markup.
    /// </summary>
    public static string? SanitizeCss(string? css) =>
        string.IsNullOrWhiteSpace(css) ? null : StyleCloseRegex().Replace(css, "<\\/style");

    private async Task SaveAsync(CustomPage page, CancellationToken ct)
    {
        await MediaReferenceTracker.ReplaceAsync(db, MediaOwnerType.CustomPage, page.Id,
            [("html", null, page.ContentHtml), ("css", null, page.CustomCss)], ct);
        await db.SaveChangesAsync(ct);
        cache.Invalidate();
    }

    private static CustomPageDto ToDto(CustomPage p) =>
        new(p.Id, p.Title, p.Slug, p.ContentHtml, p.CustomCss, p.Layout, p.CreatedAt, p.UpdatedAt);
}
