using CashewBlog.Application.Abstractions;

namespace CashewBlog.Infrastructure.Media;

/// <summary>
/// Filesystem storage under the configured uploads root. Every path is validated to stay
/// inside the root (no '..', no absolute paths, no drive letters, no NUL).
/// </summary>
public sealed class LocalMediaStorage(IConfigStore config) : IMediaStorage
{
    private static readonly TimeSpan UsageCacheDuration = TimeSpan.FromMinutes(1);
    private readonly Lock _usageLock = new();
    private (DateTimeOffset At, long Bytes)? _usage;

    public string RootPath => config.StorageRoot;

    public async Task SaveAsync(string relativePath, Stream content, CancellationToken cancellationToken = default)
    {
        var full = ResolvePath(relativePath) ?? throw new ArgumentException("Invalid storage path.", nameof(relativePath));
        Directory.CreateDirectory(Path.GetDirectoryName(full)!);

        var temp = full + ".part";
        await using (var file = new FileStream(temp, FileMode.Create, FileAccess.Write, FileShare.None, 81920, useAsync: true))
        {
            await content.CopyToAsync(file, cancellationToken);
        }

        File.Move(temp, full, overwrite: true);
        lock (_usageLock)
        {
            _usage = null;
        }
    }

    public Task DeleteAsync(string relativePath, CancellationToken cancellationToken = default)
    {
        var full = ResolvePath(relativePath);
        if (full is not null && File.Exists(full))
        {
            File.Delete(full);
        }

        lock (_usageLock)
        {
            _usage = null;
        }

        return Task.CompletedTask;
    }

    public string? ResolveExisting(string relativePath)
    {
        var full = ResolvePath(relativePath);
        return full is not null && File.Exists(full) ? full : null;
    }

    public long GetUsageBytes()
    {
        lock (_usageLock)
        {
            if (_usage is { } cached && DateTimeOffset.UtcNow - cached.At < UsageCacheDuration)
            {
                return cached.Bytes;
            }
        }

        long total = 0;
        if (Directory.Exists(RootPath))
        {
            foreach (var file in new DirectoryInfo(RootPath).EnumerateFiles("*", SearchOption.AllDirectories))
            {
                total += file.Length;
            }
        }

        lock (_usageLock)
        {
            _usage = (DateTimeOffset.UtcNow, total);
        }

        return total;
    }

    /// <summary>Maps a relative '/'-separated path to a full path inside the root, or null if unsafe.</summary>
    public string? ResolvePath(string relativePath) => ResolveUnder(RootPath, relativePath);

    public static string? ResolveUnder(string root, string relativePath)
    {
        if (string.IsNullOrWhiteSpace(relativePath) || relativePath.Contains('\0') || relativePath.Contains(':'))
        {
            return null;
        }

        var segments = relativePath.Replace('\\', '/').Split('/', StringSplitOptions.RemoveEmptyEntries);
        if (segments.Length == 0 || segments.Any(s => s is "." or ".." || s.EndsWith('.') || s.StartsWith(' ')))
        {
            return null;
        }

        var rootFull = Path.GetFullPath(root);
        var full = Path.GetFullPath(Path.Combine([rootFull, .. segments]));
        var rootWithSep = rootFull.EndsWith(Path.DirectorySeparatorChar) ? rootFull : rootFull + Path.DirectorySeparatorChar;
        var comparison = OperatingSystem.IsWindows() ? StringComparison.OrdinalIgnoreCase : StringComparison.Ordinal;
        return full.StartsWith(rootWithSep, comparison) ? full : null;
    }
}
