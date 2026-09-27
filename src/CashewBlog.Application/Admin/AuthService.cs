using CashewBlog.Application.Abstractions;
using CashewBlog.Application.Common;
using CashewBlog.Application.Setup;

namespace CashewBlog.Application.Admin;

public sealed record LoginRequest(string? Password);

public sealed record ChangePasswordRequest(string? CurrentPassword, string? NewPassword);

public sealed record SessionDto(bool Authenticated, string? Name, DateTimeOffset? ExpiresAt);

/// <summary>Single-administrator password check against the Argon2id hash in config.json.</summary>
public sealed class AuthService(IConfigStore config, IPasswordHasher hasher)
{
    public const int MinPasswordLength = 8;

    public bool VerifyPassword(string? password)
    {
        var hash = config.Current?.Admin.PasswordHash;
        return !string.IsNullOrEmpty(password) && !string.IsNullOrEmpty(hash) && hasher.Verify(password, hash);
    }

    public async Task ChangePasswordAsync(ChangePasswordRequest request, CancellationToken ct)
    {
        if (!VerifyPassword(request.CurrentPassword))
        {
            throw new ValidationException("currentPassword", "Current password is incorrect.");
        }

        ValidateNewPassword(request.NewPassword, "newPassword");
        var current = config.Current ?? throw new InvalidOperationException("Not initialized.");
        var updated = new AppConfig
        {
            ConfigVersion = current.ConfigVersion,
            Admin = new AdminConfig { PasswordHash = hasher.Hash(request.NewPassword!) },
            Database = current.Database,
            Storage = current.Storage,
        };
        await config.SaveAsync(updated, ct);
    }

    public static void ValidateNewPassword(string? password, string field)
    {
        if (string.IsNullOrEmpty(password) || password.Length < MinPasswordLength)
        {
            throw new ValidationException(field, $"Password must be at least {MinPasswordLength} characters.");
        }

        if (password.Length > 256)
        {
            throw new ValidationException(field, "Password must be at most 256 characters.");
        }
    }
}
