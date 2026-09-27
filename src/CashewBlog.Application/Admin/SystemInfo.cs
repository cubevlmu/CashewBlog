namespace CashewBlog.Application.Admin;

public sealed record DiskInfoDto(string Path, long? TotalBytes, long? FreeBytes);

public sealed record DatabaseInfoDto(bool Healthy, string? ServerVersion, double? LatencyMs, string? Error);

public sealed record SystemInfoDto(
    string Version,
    DateTimeOffset StartedAt,
    long UptimeSeconds,
    double? CpuUsagePercent,
    int ProcessorCount,
    long ProcessMemoryBytes,
    long GcHeapBytes,
    long? SystemMemoryTotalBytes,
    long? SystemMemoryAvailableBytes,
    string DotnetVersion,
    string OsDescription,
    string? NodeVersion,
    string? AstroVersion,
    DatabaseInfoDto Database,
    DiskInfoDto UploadsDisk,
    DiskInfoDto DataDisk,
    long UploadsUsageBytes,
    int MediaCount);

public sealed record HealthComponentDto(string Name, bool Healthy, string? Detail);

public sealed record SystemHealthDto(bool Healthy, IReadOnlyList<HealthComponentDto> Components);

/// <summary>Runtime/host metrics for the admin dashboard. Implemented in Infrastructure.</summary>
public interface ISystemInfoService
{
    Task<SystemInfoDto> GetInfoAsync(CancellationToken ct);
    Task<DatabaseInfoDto> CheckDatabaseAsync(CancellationToken ct);
}
