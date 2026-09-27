using CashewBlog.Application.Abstractions;
using SixLabors.ImageSharp;
using SixLabors.ImageSharp.Formats.Webp;
using SixLabors.ImageSharp.Processing;

namespace CashewBlog.Infrastructure.Media;

public sealed class ImageSharpProcessor : IImageProcessor
{
    public async Task<ImageProbe?> ProbeAsync(Stream stream, CancellationToken cancellationToken = default)
    {
        try
        {
            // Full decode (not just Identify) so truncated/corrupt files are rejected as images.
            using var image = await Image.LoadAsync(stream, cancellationToken);
            image.Mutate(x => x.AutoOrient());
            var format = image.Metadata.DecodedImageFormat;
            if (format is null)
            {
                return null;
            }

            var extension = format.FileExtensions.FirstOrDefault() ?? "img";
            if (extension == "jpeg")
            {
                extension = "jpg";
            }

            return new ImageProbe(image.Width, image.Height, format.DefaultMimeType, "." + extension);
        }
        catch (Exception ex) when (ex is UnknownImageFormatException or InvalidImageContentException or NotSupportedException or ImageFormatException)
        {
            return null;
        }
    }

    public async Task<ImageVariant> CreateWebPAsync(Stream source, int maxEdge, int quality, CancellationToken cancellationToken = default)
    {
        using var image = await Image.LoadAsync(source, cancellationToken);
        image.Mutate(x =>
        {
            x.AutoOrient();
            if (image.Width > maxEdge || image.Height > maxEdge)
            {
                x.Resize(new ResizeOptions { Mode = ResizeMode.Max, Size = new Size(maxEdge, maxEdge) });
            }
        });

        // Strip EXIF/XMP (may contain GPS data) from the public variants; the original is kept untouched.
        image.Metadata.ExifProfile = null;
        image.Metadata.XmpProfile = null;
        image.Metadata.IptcProfile = null;

        var output = new MemoryStream();
        await image.SaveAsync(output, new WebpEncoder { Quality = quality, FileFormat = WebpFileFormatType.Lossy }, cancellationToken);
        output.Position = 0;
        return new ImageVariant(output, image.Width, image.Height);
    }
}
