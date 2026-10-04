using System.Text.Json;
using CashewBlog.Application.Abstractions;
using CashewBlog.Application.Setup;
using CashewBlog.Domain.Rules;
using Microsoft.Extensions.Logging;
using Npgsql;

namespace CashewBlog.Infrastructure.Configuration;

/// <summary>Paths resolved by the host at startup.</summary>
public sealed record RuntimePaths(string DataDirectory, string ContentRoot, string DefaultStorageRoot);

/// <summary>
/// Loads/saves <c>{DataDir}/config.json</c>. A missing or incomplete file means "setup required";
/// a malformed or invalid file stops startup with an operator-facing error.
/// </summary>
public sealed class JsonConfigStore : IConfigStore
{
    public const string FileName = "config.json";

    private static readonly JsonSerializerOptions FileJson = new()
    {
        WriteIndented = true,
        PropertyNameCaseInsensitive = true,
        ReadCommentHandling = JsonCommentHandling.Skip,
        AllowTrailingCommas = true,
    };

    private readonly RuntimePaths _paths;
    private readonly SemaphoreSlim _writeLock = new(1, 1);
    private volatile AppConfig? _current;
    private volatile string? _connectionString;

    public JsonConfigStore(RuntimePaths paths, ILogger<JsonConfigStore> logger)
    {
        _paths = paths;
        Directory.CreateDirectory(paths.DataDirectory);
        var config = Load(ConfigPath);
        if (config is not null && !config.IsComplete)
        {
            logger.LogWarning("{Path} is incomplete; starting in setup mode", ConfigPath);
            config = null;
        }

        if (config is not null)
        {
            Apply(config);
        }
    }

    public string DataDirectory => _paths.DataDirectory;
    public string ConfigPath => Path.Combine(_paths.DataDirectory, FileName);
    public AppConfig? Current => _current;
    public bool IsInitialized => _current is not null;
    public string? ConnectionString => _connectionString;

    public string StorageRoot => ResolveStorageRoot(_current?.Storage.Root);

    public long MaxUploadBytes => _current?.Storage.MaxUploadBytes is > 0 and var v ? v : StorageConfig.DefaultMaxUploadBytes;

    public string ResolveStorageRoot(string? configured)
    {
        if (string.IsNullOrWhiteSpace(configured))
        {
            return Path.GetFullPath(_paths.DefaultStorageRoot);
        }

        return Path.IsPathRooted(configured)
            ? Path.GetFullPath(configured)
            : Path.GetFullPath(Path.Combine(_paths.ContentRoot, configured));
    }

    public async Task SaveAsync(AppConfig config, CancellationToken cancellationToken = default)
    {
        Validate(config);
        await _writeLock.WaitAsync(cancellationToken);
        try
        {
            // Write to a temp file in the same directory, then rename over the target:
            // readers never observe a half-written config.
            var temp = ConfigPath + ".tmp";
            await using (var stream = new FileStream(temp, FileMode.Create, FileAccess.Write, FileShare.None))
            {
                await JsonSerializer.SerializeAsync(stream, config, FileJson, cancellationToken);
                await stream.FlushAsync(cancellationToken);
            }

            File.Move(temp, ConfigPath, overwrite: true);
            TryRestrictPermissions(ConfigPath);
            Apply(config);
        }
        finally
        {
            _writeLock.Release();
        }
    }

    public static string BuildConnectionString(DatabaseConfig db, int timeoutSeconds = 15)
    {
        if (!Enum.TryParse<SslMode>(db.SslMode, ignoreCase: true, out var sslMode))
        {
            throw new InvalidOperationException($"Unknown Database.SslMode '{db.SslMode}'. Use Disable, Allow, Prefer, Require, VerifyCA or VerifyFull.");
        }

        var builder = new NpgsqlConnectionStringBuilder
        {
            Host = db.Host,
            Port = db.Port,
            Database = db.Database,
            Username = db.Username,
            Password = string.IsNullOrEmpty(db.Password) ? null : db.Password,
            SslMode = sslMode,
            Timeout = timeoutSeconds,
            ApplicationName = "CashewBlog",
        };
        return builder.ConnectionString;
    }

    private void Apply(AppConfig config)
    {
        _connectionString = BuildConnectionString(config.Database);
        _current = config;
    }

    private static AppConfig? Load(string path)
    {
        if (!File.Exists(path))
        {
            return null;
        }

        AppConfig? config;
        try
        {
            config = JsonSerializer.Deserialize<AppConfig>(File.ReadAllText(path), FileJson);
        }
        catch (JsonException ex)
        {
            throw new InvalidOperationException(
                $"CashewBlog configuration file '{path}' is not valid JSON ({ex.Message}). Fix or remove it and restart.", ex);
        }

        if (config is null)
        {
            return null;
        }

        if (config.IsComplete)
        {
            try
            {
                Validate(config);
            }
            catch (InvalidOperationException ex)
            {
                throw new InvalidOperationException($"CashewBlog configuration file '{path}' is invalid: {ex.Message}", ex);
            }
        }

        return config;
    }

    private static void Validate(AppConfig config)
    {
        if (config.ConfigVersion > AppConfig.CurrentVersion)
        {
            throw new InvalidOperationException($"ConfigVersion {config.ConfigVersion} is newer than this build supports ({AppConfig.CurrentVersion}).");
        }

        if (config.Database.Port is < 1 or > 65535)
        {
            throw new InvalidOperationException("Database.Port must be between 1 and 65535.");
        }

        if (!config.Admin.PasswordHash.StartsWith("$argon2id$", StringComparison.Ordinal))
        {
            throw new InvalidOperationException("Admin.PasswordHash must be an Argon2id PHC string.");
        }

        if (!string.IsNullOrWhiteSpace(config.Admin.LoginPath)
            && LoginPathRules.Normalize(config.Admin.LoginPath) is var (normalized, error)
            && (error is not null || normalized != config.Admin.LoginPath))
        {
            throw new InvalidOperationException($"Admin.LoginPath must be a single lower-case path segment such as \"/my-entrance\" ({error ?? "use " + normalized}).");
        }

        var turnstile = config.Admin.Turnstile;
        if (string.IsNullOrWhiteSpace(turnstile.SiteKey) != string.IsNullOrWhiteSpace(turnstile.SecretKey))
        {
            throw new InvalidOperationException("Admin.Turnstile needs both SiteKey and SecretKey, or neither.");
        }

        _ = BuildConnectionString(config.Database); // validates SslMode
    }

    private static void TryRestrictPermissions(string path)
    {
        if (!OperatingSystem.IsWindows())
        {
            try
            {
                File.SetUnixFileMode(path, UnixFileMode.UserRead | UnixFileMode.UserWrite);
            }
            catch (IOException)
            {
                // Best effort (e.g. filesystems without POSIX permissions).
            }
            catch (UnauthorizedAccessException)
            {
            }
        }
    }
}
