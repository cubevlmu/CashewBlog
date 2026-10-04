using System.Collections.Concurrent;
using CashewBlog.Application.Abstractions;

namespace CashewBlog.Infrastructure.Security;

/// <summary>
/// Per-IP lockout for the admin login, layered on the fixed-window rate limiter: after
/// <see cref="MaxFailures"/> failures inside <see cref="Window"/> the address is locked out; each
/// further lockout doubles (up to <see cref="MaxLockout"/>). A successful login clears the record.
/// In-memory on purpose: CashewBlog runs as a single instance.
/// </summary>
public sealed class LoginThrottle(IClock clock)
{
    public const int MaxFailures = 5;
    public static readonly TimeSpan Window = TimeSpan.FromMinutes(15);
    public static readonly TimeSpan FirstLockout = TimeSpan.FromMinutes(15);
    public static readonly TimeSpan MaxLockout = TimeSpan.FromHours(24);
    private const int MaxTracked = 10_000;

    private readonly ConcurrentDictionary<string, Entry> _entries = new();

    /// <summary>Remaining lockout for <paramref name="key"/>, or null when attempts are allowed.</summary>
    public TimeSpan? LockedFor(string key)
    {
        if (!_entries.TryGetValue(key, out var entry))
        {
            return null;
        }

        lock (entry)
        {
            var remaining = entry.LockedUntil - clock.UtcNow;
            return remaining > TimeSpan.Zero ? remaining : null;
        }
    }

    /// <summary>Records a failure; returns the lockout that starts now, if any.</summary>
    public TimeSpan? RecordFailure(string key)
    {
        var now = clock.UtcNow;
        if (_entries.Count >= MaxTracked)
        {
            Prune(now);
        }

        var entry = _entries.GetOrAdd(key, _ => new Entry());
        lock (entry)
        {
            if (now - entry.WindowStart > Window)
            {
                entry.WindowStart = now;
                entry.Failures = 0;
            }

            entry.LastSeen = now;
            if (++entry.Failures < MaxFailures)
            {
                return null;
            }

            var lockout = TimeSpan.FromTicks(Math.Min(FirstLockout.Ticks << Math.Min(entry.Lockouts, 16), MaxLockout.Ticks));
            entry.Lockouts++;
            entry.Failures = 0;
            entry.WindowStart = now;
            entry.LockedUntil = now + lockout;
            return lockout;
        }
    }

    public void Reset(string key) => _entries.TryRemove(key, out _);

    private void Prune(DateTimeOffset now)
    {
        foreach (var (key, entry) in _entries)
        {
            // Forget addresses that are neither locked nor recently active (lockout history included).
            if (entry.LockedUntil < now && now - entry.LastSeen > MaxLockout)
            {
                _entries.TryRemove(key, out _);
            }
        }
    }

    private sealed class Entry
    {
        public DateTimeOffset WindowStart;
        public DateTimeOffset LastSeen;
        public DateTimeOffset LockedUntil;
        public int Failures;
        public int Lockouts;
    }
}
