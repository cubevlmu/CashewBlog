using System.Globalization;
using System.Security.Cryptography;
using System.Text;
using CashewBlog.Application.Abstractions;
using Konscious.Security.Cryptography;

namespace CashewBlog.Infrastructure.Security;

/// <summary>
/// Argon2id password hashing encoded as a PHC string:
/// <c>$argon2id$v=19$m=19456,t=2,p=1$&lt;salt&gt;$&lt;hash&gt;</c> (base64 without padding).
/// Defaults follow the OWASP minimum recommendation (19 MiB, 2 iterations, 1 lane).
/// </summary>
public sealed class Argon2PasswordHasher : IPasswordHasher
{
    private const int MemoryKib = 19456;
    private const int Iterations = 2;
    private const int Parallelism = 1;
    private const int SaltLength = 16;
    private const int HashLength = 32;

    public string Hash(string password)
    {
        var salt = RandomNumberGenerator.GetBytes(SaltLength);
        var hash = Compute(password, salt, MemoryKib, Iterations, Parallelism, HashLength);
        return $"$argon2id$v=19$m={MemoryKib},t={Iterations},p={Parallelism}${B64(salt)}${B64(hash)}";
    }

    public bool Verify(string password, string encodedHash)
    {
        // $argon2id$v=19$m=..,t=..,p=..$salt$hash  → ["", "argon2id", "v=19", "m=..", salt, hash]
        var parts = encodedHash.Split('$');
        if (parts.Length != 6 || parts[1] != "argon2id" || parts[2] != "v=19")
        {
            return false;
        }

        int memory = 0, iterations = 0, parallelism = 0;
        foreach (var kv in parts[3].Split(','))
        {
            var pair = kv.Split('=', 2);
            if (pair.Length != 2 || !int.TryParse(pair[1], NumberStyles.None, CultureInfo.InvariantCulture, out var value))
            {
                return false;
            }

            switch (pair[0])
            {
                case "m": memory = value; break;
                case "t": iterations = value; break;
                case "p": parallelism = value; break;
            }
        }

        if (memory < 8 || iterations < 1 || parallelism < 1)
        {
            return false;
        }

        byte[] salt, expected;
        try
        {
            salt = FromB64(parts[4]);
            expected = FromB64(parts[5]);
        }
        catch (FormatException)
        {
            return false;
        }

        var actual = Compute(password, salt, memory, iterations, parallelism, expected.Length);
        return CryptographicOperations.FixedTimeEquals(actual, expected);
    }

    private static byte[] Compute(string password, byte[] salt, int memory, int iterations, int parallelism, int length)
    {
        using var argon = new Argon2id(Encoding.UTF8.GetBytes(password))
        {
            Salt = salt,
            MemorySize = memory,
            Iterations = iterations,
            DegreeOfParallelism = parallelism,
        };
        return argon.GetBytes(length);
    }

    private static string B64(byte[] bytes) => Convert.ToBase64String(bytes).TrimEnd('=');

    private static byte[] FromB64(string value) =>
        Convert.FromBase64String(value.PadRight(value.Length + (4 - value.Length % 4) % 4, '='));
}
