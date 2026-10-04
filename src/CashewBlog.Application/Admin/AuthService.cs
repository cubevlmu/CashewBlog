using CashewBlog.Application.Abstractions;
using CashewBlog.Application.Common;
using CashewBlog.Application.Setup;
using CashewBlog.Domain.Rules;
using Microsoft.EntityFrameworkCore;

namespace CashewBlog.Application.Admin;

public sealed record LoginRequest(string? Password, string? TurnstileToken);

public sealed record LoginOptionsDto(string? TurnstileSiteKey);

public sealed record ChangePasswordRequest(string? CurrentPassword, string? NewPassword);

public sealed record SessionDto(bool Authenticated, string? Name, DateTimeOffset? ExpiresAt);

/// <summary>Login protection as shown to the admin; the Turnstile secret is only reported as present.</summary>
public sealed record SecuritySettingsDto(string LoginPath, bool LoginPathHidden, string? TurnstileSiteKey, bool HasTurnstileSecret);

/// <summary>
/// <c>TurnstileSecretKey</c> null keeps the stored secret. Changing the Turnstile keys requires a
/// <c>TurnstileToken</c> solved with the new site key, so a mistyped key cannot lock the admin out.
/// </summary>
public sealed record UpdateSecuritySettingsRequest(
    string? CurrentPassword,
    string? LoginPath,
    bool TurnstileEnabled,
    string? TurnstileSiteKey,
    string? TurnstileSecretKey,
    string? TurnstileToken);

/// <summary>Single-administrator password check against the Argon2id hash in config.json.</summary>
public sealed class AuthService(IConfigStore config, IPasswordHasher hasher, ITurnstileVerifier turnstile, IApplicationDbContext db)
{
    public const int MinPasswordLength = 8;
    public const int MaxPasswordLength = 256;

    public TurnstileConfig Turnstile => config.Current?.Admin.Turnstile ?? new TurnstileConfig();

    public bool VerifyPassword(string? password)
    {
        var hash = config.Current?.Admin.PasswordHash;
        return !string.IsNullOrEmpty(password) && password.Length <= MaxPasswordLength
            && !string.IsNullOrEmpty(hash) && hasher.Verify(password, hash);
    }

    /// <summary>True when Turnstile is off or the token passes.</summary>
    public Task<bool> VerifyTurnstileAsync(string? token, string? remoteIp, CancellationToken ct) =>
        Turnstile is { Enabled: true } t ? turnstile.VerifyAsync(t.SecretKey, token, remoteIp, ct) : Task.FromResult(true);

    public async Task ChangePasswordAsync(ChangePasswordRequest request, CancellationToken ct)
    {
        if (!VerifyPassword(request.CurrentPassword))
        {
            throw new ValidationException("currentPassword", "Current password is incorrect.");
        }

        ValidateNewPassword(request.NewPassword, "newPassword");
        var current = config.Current ?? throw new InvalidOperationException("Not initialized.");
        await config.SaveAsync(With(current, current.Admin.With(passwordHash: hasher.Hash(request.NewPassword!))), ct);
    }

    public SecuritySettingsDto GetSecuritySettings()
    {
        var admin = config.Current?.Admin ?? new AdminConfig();
        return new SecuritySettingsDto(
            admin.EffectiveLoginPath,
            admin.EffectiveLoginPath != LoginPathRules.Default,
            admin.Turnstile.Enabled ? admin.Turnstile.SiteKey : null,
            admin.Turnstile.Enabled);
    }

    public async Task<SecuritySettingsDto> UpdateSecuritySettingsAsync(UpdateSecuritySettingsRequest request, string? remoteIp, CancellationToken ct)
    {
        if (!VerifyPassword(request.CurrentPassword))
        {
            throw new ValidationException("currentPassword", "Current password is incorrect.");
        }

        var current = config.Current ?? throw new InvalidOperationException("Not initialized.");
        var (loginPath, pathError) = LoginPathRules.Normalize(request.LoginPath);
        if (pathError is not null)
        {
            throw new ValidationException("loginPath", pathError);
        }

        var slug = loginPath.TrimStart('/');
        if (await db.CustomPages.AnyAsync(p => p.Slug == slug || p.Slug.StartsWith(slug + "/"), ct))
        {
            throw new ValidationException("loginPath", "A custom page already uses this address.");
        }

        var stored = current.Admin.Turnstile;
        var next = new TurnstileConfig();
        if (request.TurnstileEnabled)
        {
            next.SiteKey = request.TurnstileSiteKey?.Trim() ?? "";
            next.SecretKey = string.IsNullOrWhiteSpace(request.TurnstileSecretKey) ? stored.SecretKey : request.TurnstileSecretKey.Trim();
            await ValidateTurnstileKeysAsync(turnstile, next, stored, request.TurnstileToken, remoteIp, "turnstile", ct);
        }

        await config.SaveAsync(With(current, current.Admin.With(loginPath: loginPath, turnstile: next)), ct);
        return GetSecuritySettings();
    }

    /// <summary>
    /// Checks a new Turnstile key pair: both keys present and, when they differ from <paramref name="stored"/>,
    /// a token solved with the new site key must pass siteverify with the new secret.
    /// </summary>
    public static async Task ValidateTurnstileKeysAsync(ITurnstileVerifier verifier, TurnstileConfig next, TurnstileConfig? stored,
        string? token, string? remoteIp, string field, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(next.SiteKey) || string.IsNullOrWhiteSpace(next.SecretKey))
        {
            throw new ValidationException(field, "Both the Turnstile site key and secret key are required.");
        }

        if (next.SiteKey.Length > 200 || next.SecretKey.Length > 200)
        {
            throw new ValidationException(field, "Turnstile keys must be at most 200 characters.");
        }

        var unchanged = stored is { Enabled: true } && stored.SiteKey == next.SiteKey && stored.SecretKey == next.SecretKey;
        if (!unchanged && !await verifier.VerifyAsync(next.SecretKey, token, remoteIp, ct))
        {
            throw new ValidationException(field, "Turnstile verification failed with these keys. Check both keys and complete the challenge again.");
        }
    }

    public static void ValidateNewPassword(string? password, string field)
    {
        if (string.IsNullOrEmpty(password) || password.Length < MinPasswordLength)
        {
            throw new ValidationException(field, $"Password must be at least {MinPasswordLength} characters.");
        }

        if (password.Length > MaxPasswordLength)
        {
            throw new ValidationException(field, $"Password must be at most {MaxPasswordLength} characters.");
        }
    }

    private static AppConfig With(AppConfig current, AdminConfig admin) => new()
    {
        ConfigVersion = current.ConfigVersion,
        Admin = admin,
        Database = current.Database,
        Storage = current.Storage,
    };
}
