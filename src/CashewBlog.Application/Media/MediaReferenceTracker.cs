using System.Text.RegularExpressions;
using CashewBlog.Application.Abstractions;
using CashewBlog.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace CashewBlog.Application.Media;

/// <summary>
/// Maintains the MediaReferences table. Generated upload names start with the asset's
/// UUID, so any <c>/uploads/yyyy/MM/{uuid}...</c> URL (relative or absolute, any variant)
/// identifies the asset without a path lookup.
/// </summary>
public static partial class MediaReferenceTracker
{
    [GeneratedRegex(@"/uploads/\d{4}/\d{2}/([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})", RegexOptions.CultureInvariant)]
    private static partial Regex UploadUrlRegex();

    public static IEnumerable<Guid> ExtractAssetIds(string? text)
    {
        if (string.IsNullOrEmpty(text))
        {
            yield break;
        }

        foreach (Match match in UploadUrlRegex().Matches(text))
        {
            if (Guid.TryParse(match.Groups[1].Value, out var id))
            {
                yield return id;
            }
        }
    }

    /// <summary>
    /// Replaces all references held by one owner. <paramref name="fields"/> maps a field key to
    /// explicit asset ids and/or text to scan. Changes are staged; the caller saves.
    /// </summary>
    public static async Task ReplaceAsync(
        IApplicationDbContext db,
        MediaOwnerType ownerType,
        Guid? ownerId,
        IEnumerable<(string FieldKey, Guid? AssetId, string? Text)> fields,
        CancellationToken ct)
    {
        var wanted = new HashSet<(Guid AssetId, string FieldKey)>();
        foreach (var (fieldKey, assetId, text) in fields)
        {
            if (assetId is { } id)
            {
                wanted.Add((id, fieldKey));
            }

            foreach (var found in ExtractAssetIds(text))
            {
                wanted.Add((found, fieldKey));
            }
        }

        var candidateIds = wanted.Select(w => w.AssetId).Distinct().ToList();
        var existingAssets = candidateIds.Count == 0
            ? []
            : await db.MediaAssets.Where(m => candidateIds.Contains(m.Id)).Select(m => m.Id).ToListAsync(ct);
        var existingSet = existingAssets.ToHashSet();

        var current = await db.MediaReferences
            .Where(r => r.OwnerType == ownerType && r.OwnerId == ownerId)
            .ToListAsync(ct);

        var target = wanted.Where(w => existingSet.Contains(w.AssetId)).ToHashSet();
        foreach (var reference in current)
        {
            if (!target.Remove((reference.MediaAssetId, reference.FieldKey)))
            {
                db.MediaReferences.Remove(reference);
            }
        }

        foreach (var (assetId, fieldKey) in target)
        {
            db.MediaReferences.Add(new MediaReference
            {
                MediaAssetId = assetId,
                OwnerType = ownerType,
                OwnerId = ownerId,
                FieldKey = fieldKey,
            });
        }
    }

    public static Task RemoveOwnerAsync(IApplicationDbContext db, MediaOwnerType ownerType, Guid? ownerId, CancellationToken ct) =>
        db.MediaReferences.Where(r => r.OwnerType == ownerType && r.OwnerId == ownerId).ExecuteDeleteAsync(ct);
}
