namespace CashewBlog.Application.Setup;

/// <summary>
/// Shape of <c>{DataDir}/config.json</c>. Infrastructure-level settings only; everything
/// site-related lives in the SiteSettings table. Property names are PascalCase on disk.
/// </summary>
public sealed class AppConfig
{
    public const int CurrentVersion = 1;

    public int ConfigVersion { get; set; } = CurrentVersion;
    public AdminConfig Admin { get; set; } = new();
    public DatabaseConfig Database { get; set; } = new();
    public StorageConfig Storage { get; set; } = new();

    /// <summary>True when every value required to run is present.</summary>
    public bool IsComplete =>
        !string.IsNullOrWhiteSpace(Admin.PasswordHash)
        && !string.IsNullOrWhiteSpace(Database.Host)
        && !string.IsNullOrWhiteSpace(Database.Database)
        && !string.IsNullOrWhiteSpace(Database.Username);
}

public sealed class AdminConfig
{
    public string PasswordHash { get; set; } = "";
}

public sealed class DatabaseConfig
{
    public string Host { get; set; } = "";
    public int Port { get; set; } = 5432;
    public string Database { get; set; } = "";
    public string Username { get; set; } = "";
    public string Password { get; set; } = "";

    /// <summary>Npgsql SslMode name: Disable, Allow, Prefer, Require, VerifyCA, VerifyFull.</summary>
    public string SslMode { get; set; } = "Prefer";
}

public sealed class StorageConfig
{
    public const long DefaultMaxUploadBytes = 100L * 1024 * 1024;

    /// <summary>Absolute path, or relative to the content root. Empty = default.</summary>
    public string Root { get; set; } = "";
    public long MaxUploadBytes { get; set; } = DefaultMaxUploadBytes;
}
