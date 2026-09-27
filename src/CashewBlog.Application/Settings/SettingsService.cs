using System.Globalization;
using System.Text.Json;
using System.Text.Json.Nodes;
using CashewBlog.Application.Abstractions;
using CashewBlog.Application.Common;
using CashewBlog.Application.Media;
using CashewBlog.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace CashewBlog.Application.Settings;

public sealed class SettingsService(IApplicationDbContext db, IClock clock, IPublicCache cache)
{
    public async Task<SiteSettings> GetAsync(CancellationToken ct = default)
    {
        var record = await db.SiteSettings.AsNoTracking().FirstOrDefaultAsync(s => s.Id == SiteSettingsRecord.SingletonId, ct);
        return record is null ? new SiteSettings() : Deserialize(record.Data, record.SchemaVersion);
    }

    /// <summary>
    /// Replaces the sections present in <paramref name="body"/>; omitted sections keep their
    /// current values. Sending the full document therefore works as a full replace.
    /// </summary>
    public async Task<SiteSettings> UpdateAsync(JsonElement body, CancellationToken ct = default)
    {
        if (body.ValueKind != JsonValueKind.Object)
        {
            throw new ValidationException("body", "Settings must be a JSON object.");
        }

        var current = await GetAsync(ct);
        var node = JsonSerializer.SerializeToNode(current, AppJson.Options)!.AsObject();
        var errors = new ValidationErrors();

        foreach (var property in body.EnumerateObject())
        {
            if (property.NameEquals("schemaVersion"))
            {
                continue;
            }

            if (!SiteSettings.SectionNames.Contains(property.Name))
            {
                errors.Add(property.Name, "Unknown settings section.");
                continue;
            }

            node[property.Name] = JsonNode.Parse(property.Value.GetRawText());
        }

        errors.ThrowIfAny();

        SiteSettings updated;
        try
        {
            updated = node.Deserialize<SiteSettings>(AppJson.Options)
                ?? throw new ValidationException("body", "Settings must not be null.");
        }
        catch (JsonException ex)
        {
            throw new ValidationException(ex.Path?.TrimStart('$', '.') is { Length: > 0 } p ? p : "body", ex.Message);
        }

        updated = Normalize(updated);
        Validate(updated);
        await SaveAsync(updated, ct);
        return updated;
    }

    public async Task<SiteSettings> ResetSectionAsync(string section, CancellationToken ct = default)
    {
        if (!SiteSettings.SectionNames.Contains(section))
        {
            throw new NotFoundException($"Unknown settings section '{section}'.");
        }

        var current = await GetAsync(ct);
        var node = JsonSerializer.SerializeToNode(current, AppJson.Options)!.AsObject();
        var defaults = JsonSerializer.SerializeToNode(new SiteSettings(), AppJson.Options)!.AsObject();
        node[section] = defaults[section]!.DeepClone();

        var updated = node.Deserialize<SiteSettings>(AppJson.Options)!;
        await SaveAsync(updated, ct);
        return updated;
    }

    /// <summary>Initial document written by setup.</summary>
    public static SiteSettings CreateInitial(string siteName, string siteUrl, string adminName, string timezone, DateOnly today)
    {
        var defaults = new SiteSettings();
        return defaults with
        {
            General = defaults.General with
            {
                SiteName = siteName,
                SiteUrl = siteUrl,
                Timezone = timezone,
                SiteStartDate = today.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
            },
            Profile = defaults.Profile with { Name = adminName },
            Banner = defaults.Banner with { HomeText = defaults.Banner.HomeText with { Title = siteName } },
        };
    }

    public static string Serialize(SiteSettings settings) =>
        JsonSerializer.Serialize(settings with { SchemaVersion = SiteSettings.CurrentSchemaVersion }, AppJson.Options);

    public static SiteSettings Deserialize(string json, int schemaVersion)
    {
        var node = JsonNode.Parse(string.IsNullOrWhiteSpace(json) ? "{}" : json)?.AsObject() ?? [];
        Migrate(node, schemaVersion);
        return node.Deserialize<SiteSettings>(AppJson.Options) ?? new SiteSettings();
    }

    /// <summary>Upgrades older documents in place. Add a step per schema version bump.</summary>
    private static void Migrate(JsonObject node, int fromVersion)
    {
        _ = node;
        _ = fromVersion;
        // Example for a future v2:
        // if (fromVersion < 2) { node["seo"]!["titleSeparator"] = ...; }
    }

    private async Task SaveAsync(SiteSettings settings, CancellationToken ct)
    {
        var record = await db.SiteSettings.FirstOrDefaultAsync(s => s.Id == SiteSettingsRecord.SingletonId, ct);
        if (record is null)
        {
            record = new SiteSettingsRecord();
            db.SiteSettings.Add(record);
        }

        record.SchemaVersion = SiteSettings.CurrentSchemaVersion;
        record.Data = Serialize(settings);
        record.UpdatedAt = clock.UtcNow;

        await MediaReferenceTracker.ReplaceAsync(db, MediaOwnerType.SiteSettings, null, MediaFields(settings), ct);
        await db.SaveChangesAsync(ct);
        cache.Invalidate();
    }

    public static IEnumerable<(string, Guid?, string?)> MediaFields(SiteSettings s)
    {
        yield return ("avatar", null, s.Profile.Avatar);
        yield return ("favicon", null, s.General.Favicon);
        yield return ("ogImage", null, s.Seo.OgImage);
        foreach (var url in s.Banner.Desktop)
        {
            yield return ("banner", null, url);
        }

        foreach (var url in s.Banner.Mobile)
        {
            yield return ("bannerMobile", null, url);
        }
    }

    /// <summary>Trims strings and removes null list entries so validation sees clean data.</summary>
    private static SiteSettings Normalize(SiteSettings s) => s with
    {
        General = s.General with
        {
            SiteName = s.General.SiteName?.Trim() ?? "",
            SiteUrl = s.General.SiteUrl?.Trim() ?? "",
            Keywords = s.General.Keywords?.Where(k => !string.IsNullOrWhiteSpace(k)).Select(k => k.Trim()).ToList() ?? [],
            Favicon = string.IsNullOrWhiteSpace(s.General.Favicon) ? null : s.General.Favicon.Trim(),
            SiteStartDate = string.IsNullOrWhiteSpace(s.General.SiteStartDate) ? null : s.General.SiteStartDate.Trim(),
        },
        Profile = s.Profile with { Avatar = string.IsNullOrWhiteSpace(s.Profile.Avatar) ? null : s.Profile.Avatar.Trim() },
        Seo = s.Seo with { OgImage = string.IsNullOrWhiteSpace(s.Seo.OgImage) ? null : s.Seo.OgImage.Trim() },
    };

    public static void Validate(SiteSettings s)
    {
        var e = new ValidationErrors();

        // general
        e.Require(!string.IsNullOrWhiteSpace(s.General.SiteName) && s.General.SiteName.Length <= 100, "general.siteName", "Site name is required (max 100 characters).");
        e.Require(IsHttpUrl(s.General.SiteUrl), "general.siteUrl", "Site URL must be an absolute http(s) URL.");
        e.Require(IsValidTimeZone(s.General.Timezone), "general.timezone", "Unknown time zone id.");
        e.Require(!string.IsNullOrWhiteSpace(s.General.Language), "general.language", "Language is required.");
        e.Require(s.General.SiteStartDate is null || DateOnly.TryParseExact(s.General.SiteStartDate, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out _),
            "general.siteStartDate", "Use the yyyy-MM-dd format.");

        // profile
        for (var i = 0; i < s.Profile.Links.Count; i++)
        {
            e.Require(!string.IsNullOrWhiteSpace(s.Profile.Links[i].Url), $"profile.links[{i}].url", "URL is required.");
        }

        // appearance
        e.Require(s.Appearance.ThemeHue is >= 0 and <= 360, "appearance.themeHue", "Must be between 0 and 360.");
        e.Require(s.Appearance.ThemeSpec is "2021" or "2025", "appearance.themeSpec", "Must be \"2021\" or \"2025\".");
        e.Require(s.Appearance.Texture.Opacity is >= 0.05 and <= 0.25, "appearance.texture.opacity", "Must be between 0.05 and 0.25.");

        // banner
        e.Require(s.Banner.Dim.Opacity is >= 0 and <= 1, "banner.dim.opacity", "Must be between 0 and 1.");
        e.Require(s.Banner.Carousel.Interval >= 3000, "banner.carousel.interval", "Must be at least 3000 ms.");
        e.Require(s.Banner.Carousel.FadeDuration >= 0, "banner.carousel.fadeDuration", "Must not be negative.");
        var tw = s.Banner.HomeText.Typewriter;
        e.Require(tw.Speed > 0 && tw.DeleteSpeed > 0 && tw.PauseTime >= 0, "banner.homeText.typewriter", "Speeds must be positive and pause time non-negative.");

        // navigation
        var ids = new HashSet<string>(StringComparer.Ordinal);
        ValidateNav(s.Navigation, "navigation", depth: 1, ids, e);

        // sidebar
        for (var i = 0; i < s.Sidebar.Widgets.Count; i++)
        {
            var w = s.Sidebar.Widgets[i];
            e.Require(w.CollapseAfter is null or >= 1, $"sidebar.widgets[{i}].collapseAfter", "Must be null or at least 1.");
        }

        // article
        var a = s.Article;
        e.Require(a.PageSize is >= 1 and <= 50, "article.pageSize", "Must be between 1 and 50.");
        e.Require(a.Toc.Depth is >= 1 and <= 3, "article.toc.depth", "Must be between 1 and 3.");
        e.Require(a.LastUpdated.MinimumAgeDays >= 0, "article.lastUpdated.minimumAgeDays", "Must not be negative.");
        e.Require(a.Discovery.RelatedCount is >= 0 and <= 6, "article.discovery.relatedCount", "Must be between 0 and 6.");
        e.Require(a.Discovery.RandomCount is >= 0 and <= 6, "article.discovery.randomCount", "Must be between 0 and 6.");

        // analytics
        if (s.Analytics.Umami.Enable)
        {
            e.Require(IsHttpUrl(s.Analytics.Umami.ScriptUrl), "analytics.umami.scriptUrl", "Script URL must be an absolute http(s) URL when Umami is enabled.");
            e.Require(!string.IsNullOrWhiteSpace(s.Analytics.Umami.WebsiteId), "analytics.umami.websiteId", "Website id is required when Umami is enabled.");
        }

        // dashboard
        var widgetIds = new HashSet<string>(StringComparer.Ordinal);
        for (var i = 0; i < s.Dashboard.Widgets.Count; i++)
        {
            var w = s.Dashboard.Widgets[i];
            e.Require(!string.IsNullOrWhiteSpace(w.Id) && widgetIds.Add(w.Id), $"dashboard.widgets[{i}].id", "Widget ids must be non-empty and unique.");
            e.Require(w.X >= 0 && w.Y >= 0 && w.W >= 1 && w.H >= 1, $"dashboard.widgets[{i}]", "Position must be non-negative and size at least 1.");
        }

        e.ThrowIfAny();
    }

    private static void ValidateNav(List<NavItem> items, string path, int depth, HashSet<string> ids, ValidationErrors e)
    {
        for (var i = 0; i < items.Count; i++)
        {
            var item = items[i];
            var p = $"{path}[{i}]";
            e.Require(!string.IsNullOrWhiteSpace(item.Id) && ids.Add(item.Id), $"{p}.id", "Navigation ids must be non-empty and unique.");
            e.Require(!string.IsNullOrWhiteSpace(item.Label), $"{p}.label", "Label is required.");

            if (item.Type == NavItemType.Page)
            {
                e.Require(!string.IsNullOrWhiteSpace(item.Target), $"{p}.target", "A custom page slug is required.");
            }

            // A url item without a target is allowed only as a pure group parent.
            if (item.Type == NavItemType.Url && string.IsNullOrWhiteSpace(item.Target) && item.Children.Count == 0)
            {
                e.Add($"{p}.target", "A URL is required.");
            }

            if (item.Children.Count > 0)
            {
                if (depth >= 2)
                {
                    e.Add($"{p}.children", "Navigation supports at most two levels.");
                }
                else
                {
                    ValidateNav(item.Children, $"{p}.children", depth + 1, ids, e);
                }
            }
        }
    }

    private static bool IsHttpUrl(string? value) =>
        Uri.TryCreate(value, UriKind.Absolute, out var uri) && uri.Scheme is "http" or "https";

    public static bool IsValidTimeZone(string? id)
    {
        if (string.IsNullOrWhiteSpace(id))
        {
            return false;
        }

        try
        {
            TimeZoneInfo.FindSystemTimeZoneById(id);
            return true;
        }
        catch (Exception ex) when (ex is TimeZoneNotFoundException or InvalidTimeZoneException)
        {
            return false;
        }
    }

    /// <summary>Resolves the site time zone, falling back to UTC.</summary>
    public static TimeZoneInfo ResolveTimeZone(string? id) =>
        IsValidTimeZone(id) ? TimeZoneInfo.FindSystemTimeZoneById(id!) : TimeZoneInfo.Utc;
}
