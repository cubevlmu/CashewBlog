namespace CashewBlog.Application.Media;

public static class MediaDimensions
{
    /// <summary>
    /// Size of the WebP display variant: the original scaled down so the longest edge is at most
    /// <see cref="MediaService.DisplayMaxEdge"/> (never upscaled, aspect ratio preserved).
    /// </summary>
    public static (int? Width, int? Height) Display(int? width, int? height, int maxEdge = MediaService.DisplayMaxEdge)
    {
        if (width is not { } w || height is not { } h || w <= 0 || h <= 0)
        {
            return (width, height);
        }

        var longest = Math.Max(w, h);
        if (longest <= maxEdge)
        {
            return (w, h);
        }

        var scale = maxEdge / (double)longest;
        return (Math.Max(1, (int)Math.Round(w * scale)), Math.Max(1, (int)Math.Round(h * scale)));
    }
}
