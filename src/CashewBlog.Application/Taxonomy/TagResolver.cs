using CashewBlog.Application.Abstractions;
using CashewBlog.Domain.Entities;
using CashewBlog.Domain.Rules;
using Microsoft.EntityFrameworkCore;

namespace CashewBlog.Application.Taxonomy;

/// <summary>Finds tags by name (case-insensitive) and creates the missing ones.</summary>
public static class TagResolver
{
    public static async Task<List<Tag>> ResolveAsync(IApplicationDbContext db, IReadOnlyList<string> names, DateTimeOffset now, CancellationToken ct)
    {
        if (names.Count == 0)
        {
            return [];
        }

        var lowered = names.Select(n => n.ToLower()).ToList();
        var existing = await db.Tags.Where(t => lowered.Contains(t.Name.ToLower())).ToListAsync(ct);
        var result = new List<Tag>(names.Count);
        HashSet<string>? takenSlugs = null;

        foreach (var name in names)
        {
            var tag = existing.FirstOrDefault(t => string.Equals(t.Name, name, StringComparison.OrdinalIgnoreCase));
            if (tag is null)
            {
                takenSlugs ??= (await db.Tags.Select(t => t.Slug).ToListAsync(ct)).ToHashSet(StringComparer.Ordinal);
                var slug = SlugGenerator.MakeUnique(SlugGenerator.FromTitle(null, name, "tag"), takenSlugs);
                takenSlugs.Add(slug);
                tag = new Tag { Name = name, Slug = slug, CreatedAt = now, UpdatedAt = now };
                db.Tags.Add(tag);
                existing.Add(tag);
            }

            result.Add(tag);
        }

        return result;
    }
}
