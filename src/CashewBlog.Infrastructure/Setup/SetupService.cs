using System.Net.Sockets;
using System.Security.Authentication;
using CashewBlog.Application.Abstractions;
using CashewBlog.Application.Admin;
using CashewBlog.Application.Analytics;
using CashewBlog.Application.Common;
using CashewBlog.Application.Settings;
using CashewBlog.Application.Setup;
using CashewBlog.Domain.Entities;
using CashewBlog.Domain.Rules;
using CashewBlog.Infrastructure.Configuration;
using CashewBlog.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Npgsql;

namespace CashewBlog.Infrastructure.Setup;

/// <summary>
/// First-run setup: validate input, test PostgreSQL, run migrations, seed SiteSettings and
/// atomically write config.json. The runtime switches to "initialized" immediately because the
/// DbContext resolves its connection string from the config store on every scope.
/// </summary>
public sealed class SetupService(
    JsonConfigStore config,
    IPasswordHasher hasher,
    ITurnstileVerifier turnstile,
    IClock clock,
    ILogger<SetupService> logger) : ISetupService
{
    public const string DefaultTimezone = "Asia/Shanghai";
    private static readonly SemaphoreSlim InitLock = new(1, 1);

    public SetupStatusDto GetStatus() => new(
        !config.IsInitialized,
        new SetupDefaultsDto(config.ResolveStorageRoot(null), StorageConfig.DefaultMaxUploadBytes, DefaultTimezone, 5432, "Prefer"));

    public async Task<DatabaseTestResult> TestDatabaseAsync(DatabaseTestRequest request, CancellationToken ct)
    {
        var (db, error) = ToDatabaseConfig(request);
        if (db is null)
        {
            return new DatabaseTestResult(false, "invalid_input", error, null, null);
        }

        string connectionString;
        try
        {
            connectionString = JsonConfigStore.BuildConnectionString(db, timeoutSeconds: 8);
        }
        catch (InvalidOperationException ex)
        {
            return new DatabaseTestResult(false, "invalid_input", ex.Message, null, null);
        }

        try
        {
            await using var connection = new NpgsqlConnection(connectionString);
            await connection.OpenAsync(ct);
            var version = connection.PostgreSqlVersion.ToString();

            await using var cmd = new NpgsqlCommand("SELECT EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'pg_trgm')", connection);
            var trigram = (bool)(await cmd.ExecuteScalarAsync(ct))!;
            return trigram
                ? new DatabaseTestResult(true, "ok", $"Connected to PostgreSQL {version}.", version, true)
                : new DatabaseTestResult(false, "extension_unavailable",
                    "Connected, but the pg_trgm extension is not available on this server (install postgresql-contrib).", version, false);
        }
        catch (PostgresException ex) when (ex.SqlState == PostgresErrorCodes.InvalidCatalogName)
        {
            return Fail("database_not_found", $"Database \"{db.Database}\" does not exist. Create it first (e.g. CREATE DATABASE {db.Database} OWNER {db.Username};).");
        }
        catch (PostgresException ex) when (ex.SqlState is PostgresErrorCodes.InvalidPassword or PostgresErrorCodes.InvalidAuthorizationSpecification)
        {
            return Fail("auth_failed", $"Authentication failed for user \"{db.Username}\".");
        }
        catch (PostgresException ex)
        {
            return Fail("error", $"PostgreSQL error {ex.SqlState}: {ex.MessageText}");
        }
        catch (NpgsqlException ex) when (ex.InnerException is TimeoutException)
        {
            return Fail("timeout", $"Timed out connecting to {db.Host}:{db.Port}.");
        }
        catch (NpgsqlException ex) when (ex.InnerException is SocketException)
        {
            return Fail("host_unreachable", $"Cannot reach {db.Host}:{db.Port} ({((SocketException)ex.InnerException).SocketErrorCode}).");
        }
        catch (NpgsqlException ex) when (ex.InnerException is AuthenticationException || ex.Message.Contains("SSL", StringComparison.OrdinalIgnoreCase))
        {
            return Fail("ssl_error", "SSL/TLS negotiation failed. Check the SSL mode and the server certificate.");
        }
        catch (TimeoutException)
        {
            return Fail("timeout", $"Timed out connecting to {db.Host}:{db.Port}.");
        }
        catch (NpgsqlException ex)
        {
            return Fail("error", ex.Message);
        }
        catch (SocketException ex)
        {
            return Fail("host_unreachable", $"Cannot reach {db.Host}:{db.Port} ({ex.SocketErrorCode}).");
        }

        static DatabaseTestResult Fail(string code, string message) => new(false, code, message, null, null);
    }

    public async Task<InitializeResult> InitializeAsync(InitializeRequest request, string? remoteIp, CancellationToken ct)
    {
        await InitLock.WaitAsync(ct);
        try
        {
            if (config.IsInitialized)
            {
                throw new NotFoundException();
            }

            // 1. Validate input.
            var errors = new ValidationErrors();
            var siteName = request.SiteName?.Trim() ?? "";
            var siteUrl = request.SiteUrl?.Trim() ?? "";
            var adminName = request.AdminName?.Trim() ?? "";
            var timezone = string.IsNullOrWhiteSpace(request.Timezone) ? DefaultTimezone : request.Timezone.Trim();
            errors.Require(siteName.Length is > 0 and <= 100, "siteName", "Site name is required (max 100 characters).");
            errors.Require(Uri.TryCreate(siteUrl, UriKind.Absolute, out var uri) && uri.Scheme is "http" or "https", "siteUrl", "Site URL must be an absolute http(s) URL.");
            errors.Require(adminName.Length is > 0 and <= 100, "adminName", "Admin display name is required.");
            errors.Require(SettingsService.IsValidTimeZone(timezone), "timezone", "Unknown time zone id.");
            try
            {
                AuthService.ValidateNewPassword(request.Password, "password");
            }
            catch (ValidationException ex)
            {
                foreach (var (key, messages) in ex.Errors)
                {
                    foreach (var message in messages)
                    {
                        errors.Add(key, message);
                    }
                }
            }

            var (db, dbError) = ToDatabaseConfig(request.Database);
            if (db is null)
            {
                errors.Add("database", dbError!);
            }

            var maxUpload = request.Storage?.MaxUploadBytes ?? StorageConfig.DefaultMaxUploadBytes;
            errors.Require(maxUpload is >= 1024 * 1024 and <= 10L * 1024 * 1024 * 1024, "storage.maxUploadBytes", "Must be between 1 MiB and 10 GiB.");
            var storageRootSetting = request.Storage?.Root?.Trim() ?? "";
            var storageRoot = config.ResolveStorageRoot(storageRootSetting);
            try
            {
                Directory.CreateDirectory(storageRoot);
            }
            catch (Exception ex) when (ex is IOException or UnauthorizedAccessException or NotSupportedException or ArgumentException)
            {
                errors.Add("storage.root", $"Cannot create or access '{storageRoot}': {ex.Message}");
            }

            var security = request.Security;
            var (loginPath, loginPathError) = string.IsNullOrWhiteSpace(security?.LoginPath)
                ? (LoginPathRules.Generate(), null)
                : LoginPathRules.Normalize(security.LoginPath);
            if (loginPathError is not null)
            {
                errors.Add("security.loginPath", loginPathError);
            }

            var turnstileKeys = new TurnstileConfig
            {
                SiteKey = security?.TurnstileSiteKey?.Trim() ?? "",
                SecretKey = security?.TurnstileSecretKey?.Trim() ?? "",
            };
            var wantsTurnstile = turnstileKeys.SiteKey.Length > 0 || turnstileKeys.SecretKey.Length > 0;

            errors.ThrowIfAny();

            // Turnstile keys are proven with a solved challenge before they can guard the login.
            if (wantsTurnstile)
            {
                await AuthService.ValidateTurnstileKeysAsync(turnstile, turnstileKeys, null, security?.TurnstileToken, remoteIp, "security.turnstile", ct);
            }

            // 2. Test the database.
            var test = await TestDatabaseAsync(request.Database!, ct);
            if (!test.Ok)
            {
                throw new ValidationException(new Dictionary<string, string[]> { ["database"] = [test.Message ?? test.Code] });
            }

            // 3. Migrate and seed.
            var connectionString = JsonConfigStore.BuildConnectionString(db!);
            try
            {
                await MigrationRunner.MigrateAsync(connectionString, logger, ct);
                await SeedAsync(connectionString, siteName, siteUrl, adminName, timezone, ct);
            }
            catch (Exception ex) when (ex is NpgsqlException or DbUpdateException or InvalidOperationException)
            {
                logger.LogError(ex, "Setup failed while migrating/seeding the database");
                throw new ValidationException("database", $"Database initialization failed: {ex.Message}");
            }

            // 4. Persist the config atomically; this flips the runtime to initialized.
            await config.SaveAsync(new AppConfig
            {
                Admin = new AdminConfig
                {
                    PasswordHash = hasher.Hash(request.Password!),
                    LoginPath = loginPath,
                    Turnstile = wantsTurnstile ? turnstileKeys : new TurnstileConfig(),
                },
                Database = db!,
                Storage = new StorageConfig { Root = storageRootSetting.Length == 0 ? storageRoot : storageRootSetting, MaxUploadBytes = maxUpload },
            }, ct);

            logger.LogInformation("CashewBlog setup completed for {SiteUrl}", siteUrl);
            return new InitializeResult(true, loginPath);
        }
        finally
        {
            InitLock.Release();
        }
    }

    private async Task SeedAsync(string connectionString, string siteName, string siteUrl, string adminName, string timezone, CancellationToken ct)
    {
        var options = new DbContextOptionsBuilder<AppDbContext>().UseNpgsql(connectionString).Options;
        await using var db = new AppDbContext(options);
        if (await db.SiteSettings.AnyAsync(ct))
        {
            // Re-running setup against an existing CashewBlog database keeps its content and settings.
            logger.LogInformation("SiteSettings already exist; keeping existing site configuration");
            return;
        }

        var now = clock.UtcNow;
        var settings = SettingsService.CreateInitial(siteName, siteUrl, adminName, timezone, AnalyticsService.LocalDate(now, timezone));
        db.SiteSettings.Add(new SiteSettingsRecord
        {
            SchemaVersion = SiteSettings.CurrentSchemaVersion,
            Data = SettingsService.Serialize(settings),
            UpdatedAt = now,
        });
        await db.SaveChangesAsync(ct);
    }

    private static (DatabaseConfig? Config, string? Error) ToDatabaseConfig(DatabaseTestRequest? r)
    {
        if (r is null || string.IsNullOrWhiteSpace(r.Host) || string.IsNullOrWhiteSpace(r.Database) || string.IsNullOrWhiteSpace(r.Username))
        {
            return (null, "Host, database and username are required.");
        }

        var port = r.Port ?? 5432;
        if (port is < 1 or > 65535)
        {
            return (null, "Port must be between 1 and 65535.");
        }

        return (new DatabaseConfig
        {
            Host = r.Host.Trim(),
            Port = port,
            Database = r.Database.Trim(),
            Username = r.Username.Trim(),
            Password = r.Password ?? "",
            SslMode = string.IsNullOrWhiteSpace(r.SslMode) ? "Prefer" : r.SslMode.Trim(),
        }, null);
    }
}
