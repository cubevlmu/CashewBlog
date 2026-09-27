using System.Diagnostics;
using System.Runtime.InteropServices;
using CashewBlog.Application.Abstractions;
using CashewBlog.Application.Admin;
using CashewBlog.Application.Settings;
using CashewBlog.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace CashewBlog.Infrastructure.SystemInfo;

/// <summary>Process CPU usage measured between consecutive samples (singleton).</summary>
public sealed class CpuSampler
{
    private readonly Lock _lock = new();
    private DateTimeOffset _lastAt = DateTimeOffset.UtcNow;
    private TimeSpan _lastCpu = Process.GetCurrentProcess().TotalProcessorTime;
    private double? _lastValue;

    public async Task<double?> SampleAsync()
    {
        TimeSpan elapsed;
        lock (_lock)
        {
            elapsed = DateTimeOffset.UtcNow - _lastAt;
        }

        // Too short an interval gives noisy numbers; take a short fresh sample instead.
        if (elapsed < TimeSpan.FromMilliseconds(250))
        {
            if (_lastValue is not null)
            {
                return _lastValue;
            }

            await Task.Delay(250);
        }

        lock (_lock)
        {
            var now = DateTimeOffset.UtcNow;
            var cpu = Process.GetCurrentProcess().TotalProcessorTime;
            var wall = (now - _lastAt).TotalMilliseconds;
            if (wall > 0)
            {
                _lastValue = Math.Round(Math.Clamp((cpu - _lastCpu).TotalMilliseconds / (wall * Environment.ProcessorCount) * 100, 0, 100), 1);
            }

            _lastAt = now;
            _lastCpu = cpu;
            return _lastValue;
        }
    }
}

/// <summary>Node/Astro versions: env vars first, then a cached best-effort <c>node --version</c>.</summary>
public sealed class RuntimeVersionProbe
{
    private readonly Lazy<string?> _node = new(ProbeNode);

    public string? NodeVersion => Environment.GetEnvironmentVariable("CASHEWBLOG_NODE_VERSION") ?? _node.Value;
    public string? AstroVersion => Environment.GetEnvironmentVariable("CASHEWBLOG_ASTRO_VERSION");

    private static string? ProbeNode()
    {
        try
        {
            using var process = Process.Start(new ProcessStartInfo("node", "--version")
            {
                RedirectStandardOutput = true,
                RedirectStandardError = true,
                UseShellExecute = false,
                CreateNoWindow = true,
            });
            if (process is null)
            {
                return null;
            }

            var output = process.StandardOutput.ReadToEnd().Trim();
            return process.WaitForExit(2000) && process.ExitCode == 0 && output.Length > 0 ? output : null;
        }
        catch (Exception ex) when (ex is System.ComponentModel.Win32Exception or InvalidOperationException or IOException)
        {
            return null;
        }
    }
}

public sealed class SystemInfoService(
    AppDbContext db,
    IConfigStore config,
    IMediaStorage storage,
    IAppInfo appInfo,
    CpuSampler cpu,
    RuntimeVersionProbe versions) : ISystemInfoService
{
    public async Task<SystemInfoDto> GetInfoAsync(CancellationToken ct)
    {
        var process = Process.GetCurrentProcess();
        var gc = GC.GetGCMemoryInfo();
        var (memTotal, memAvailable) = ReadSystemMemory(gc);
        var mediaCount = await db.MediaAssets.CountAsync(ct);

        return new SystemInfoDto(
            appInfo.Version,
            appInfo.StartedAt,
            (long)(DateTimeOffset.UtcNow - appInfo.StartedAt).TotalSeconds,
            await cpu.SampleAsync(),
            Environment.ProcessorCount,
            process.WorkingSet64,
            GC.GetTotalMemory(false),
            memTotal,
            memAvailable,
            RuntimeInformation.FrameworkDescription,
            RuntimeInformation.OSDescription,
            versions.NodeVersion,
            versions.AstroVersion,
            await CheckDatabaseAsync(ct),
            Disk(storage.RootPath),
            Disk(config.DataDirectory),
            storage.GetUsageBytes(),
            mediaCount);
    }

    public async Task<DatabaseInfoDto> CheckDatabaseAsync(CancellationToken ct)
    {
        try
        {
            var stopwatch = Stopwatch.StartNew();
            var version = (await db.Database.SqlQueryRaw<string>("SELECT current_setting('server_version') AS \"Value\"").ToListAsync(ct)).Single();
            stopwatch.Stop();
            return new DatabaseInfoDto(true, version, Math.Round(stopwatch.Elapsed.TotalMilliseconds, 2), null);
        }
        catch (Exception ex) when (ex is NpgsqlException or InvalidOperationException or TimeoutException)
        {
            return new DatabaseInfoDto(false, null, null, ex.Message);
        }
    }

    private static DiskInfoDto Disk(string path)
    {
        try
        {
            var full = Path.GetFullPath(path);
            var drive = DriveInfo.GetDrives()
                .Where(d => d.IsReady && full.StartsWith(d.RootDirectory.FullName, OperatingSystem.IsWindows() ? StringComparison.OrdinalIgnoreCase : StringComparison.Ordinal))
                .OrderByDescending(d => d.RootDirectory.FullName.Length)
                .FirstOrDefault();
            return drive is null
                ? new DiskInfoDto(full, null, null)
                : new DiskInfoDto(full, drive.TotalSize, drive.AvailableFreeSpace);
        }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException)
        {
            return new DiskInfoDto(path, null, null);
        }
    }

    private static (long? Total, long? Available) ReadSystemMemory(GCMemoryInfo gc)
    {
        long? total = gc.TotalAvailableMemoryBytes > 0 ? gc.TotalAvailableMemoryBytes : null;
        if (OperatingSystem.IsLinux() && File.Exists("/proc/meminfo"))
        {
            try
            {
                long? memTotal = null, memAvailable = null;
                foreach (var line in File.ReadLines("/proc/meminfo"))
                {
                    if (line.StartsWith("MemTotal:", StringComparison.Ordinal))
                    {
                        memTotal = ParseKb(line);
                    }
                    else if (line.StartsWith("MemAvailable:", StringComparison.Ordinal))
                    {
                        memAvailable = ParseKb(line);
                    }
                }

                return (memTotal ?? total, memAvailable);
            }
            catch (IOException)
            {
            }
        }

        return (total, null);
    }

    private static long? ParseKb(string line)
    {
        var parts = line.Split(' ', StringSplitOptions.RemoveEmptyEntries);
        return parts.Length >= 2 && long.TryParse(parts[1], out var kb) ? kb * 1024 : null;
    }
}
