using System.Security.Cryptography;
using CashewBlog.Application.Abstractions;
using CashewBlog.Application.Analytics;

namespace CashewBlog.Infrastructure.Security;

/// <summary>Random 32-byte secret stored at <c>{DataDir}/visitor-pepper.key</c>, created on first use.</summary>
public sealed class FileVisitorPepper(IConfigStore config) : IVisitorPepper
{
    private readonly Lazy<byte[]> _value = new(() => LoadOrCreate(Path.Combine(config.DataDirectory, "visitor-pepper.key")));

    public byte[] Value => _value.Value;

    private static byte[] LoadOrCreate(string path)
    {
        if (File.Exists(path))
        {
            var existing = Convert.FromBase64String(File.ReadAllText(path).Trim());
            if (existing.Length >= 16)
            {
                return existing;
            }
        }

        var pepper = RandomNumberGenerator.GetBytes(32);
        Directory.CreateDirectory(Path.GetDirectoryName(path)!);
        File.WriteAllText(path, Convert.ToBase64String(pepper));
        return pepper;
    }
}

public sealed class SystemClock : IClock
{
    public DateTimeOffset UtcNow => DateTimeOffset.UtcNow;
}
