using System.Collections.Concurrent;
using Microsoft.Extensions.Logging;

namespace CashewBlog.IntegrationTests.Infrastructure;

/// <summary>Collects server-side error logs so failed assertions can show the underlying exception.</summary>
public sealed class ServerErrorLog : ILoggerProvider
{
    private static readonly ConcurrentQueue<string> Entries = new();

    public static string Recent()
    {
        var items = Entries.ToArray();
        return items.Length == 0 ? "" : "\nServer errors:\n" + string.Join("\n---\n", items.TakeLast(3));
    }

    public ILogger CreateLogger(string categoryName) => new Logger(categoryName);

    public void Dispose()
    {
    }

    private sealed class Logger(string category) : ILogger
    {
        public IDisposable? BeginScope<TState>(TState state) where TState : notnull => null;

        public bool IsEnabled(LogLevel logLevel) => logLevel >= LogLevel.Error;

        public void Log<TState>(LogLevel logLevel, EventId eventId, TState state, Exception? exception, Func<TState, Exception?, string> formatter)
        {
            if (!IsEnabled(logLevel))
            {
                return;
            }

            Entries.Enqueue($"[{category}] {formatter(state, exception)}\n{exception}");
            while (Entries.Count > 50)
            {
                Entries.TryDequeue(out _);
            }
        }
    }
}
