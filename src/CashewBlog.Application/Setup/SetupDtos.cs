namespace CashewBlog.Application.Setup;

public sealed record SetupStatusDto(bool SetupRequired, SetupDefaultsDto Defaults);

public sealed record SetupDefaultsDto(string StorageRoot, long MaxUploadBytes, string Timezone, int DatabasePort, string SslMode);

public sealed record DatabaseTestRequest(
    string? Host,
    int? Port,
    string? Database,
    string? Username,
    string? Password,
    string? SslMode);

/// <summary>
/// Result of a connection test. <c>Code</c> is one of: ok, invalid_input, host_unreachable,
/// auth_failed, database_not_found, ssl_error, timeout, extension_unavailable, error.
/// </summary>
public sealed record DatabaseTestResult(bool Ok, string Code, string? Message, string? ServerVersion, bool? TrigramAvailable);

public sealed record InitializeRequest(
    string? SiteName,
    string? SiteUrl,
    string? AdminName,
    string? Timezone,
    string? Password,
    DatabaseTestRequest? Database,
    SetupStorageRequest? Storage);

public sealed record SetupStorageRequest(string? Root, long? MaxUploadBytes);

public sealed record InitializeResult(bool Initialized, string RedirectTo);

public interface ISetupService
{
    SetupStatusDto GetStatus();
    Task<DatabaseTestResult> TestDatabaseAsync(DatabaseTestRequest request, CancellationToken ct);
    Task<InitializeResult> InitializeAsync(InitializeRequest request, CancellationToken ct);
}
