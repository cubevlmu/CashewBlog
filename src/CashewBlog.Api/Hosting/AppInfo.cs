using System.Reflection;
using CashewBlog.Application.Settings;

namespace CashewBlog.Api.Hosting;

public sealed class AppInfo : IAppInfo
{
    public AppInfo()
    {
        var informational = typeof(AppInfo).Assembly.GetCustomAttribute<AssemblyInformationalVersionAttribute>()?.InformationalVersion ?? "0.0.0";
        // Drop the "+<commit>" build metadata for display.
        Version = informational.Split('+')[0];
    }

    public string Version { get; }
    public DateTimeOffset StartedAt { get; } = new(System.Diagnostics.Process.GetCurrentProcess().StartTime.ToUniversalTime(), TimeSpan.Zero);
}
