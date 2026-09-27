namespace CashewBlog.Application.Media;

/// <summary>Canonical public URLs for stored media. Storage paths are relative and '/'-separated.</summary>
public static class MediaUrls
{
    public const string Prefix = "/uploads/";

    public static string For(string relativePath) => Prefix + relativePath.TrimStart('/');

    public static string? ForOptional(string? relativePath) => relativePath is null ? null : For(relativePath);
}
