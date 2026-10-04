using CashewBlog.Application.Abstractions;
using CashewBlog.Domain.Rules;
using CashewBlog.Infrastructure.Security;

namespace CashewBlog.UnitTests;

public class LoginPathRulesTests
{
    [Theory]
    [InlineData("my-door", "/my-door")]
    [InlineData("/My_Door/", "/my_door")]
    [InlineData("  /abcd  ", "/abcd")]
    public void Normalizes_single_segments(string input, string expected)
    {
        var (path, error) = LoginPathRules.Normalize(input);
        Assert.Null(error);
        Assert.Equal(expected, path);
    }

    [Theory]
    [InlineData("")]
    [InlineData("abc")]
    [InlineData("a/b-long")]
    [InlineData("door.html")]
    [InlineData("门口入口入口")]
    [InlineData("admin")]
    [InlineData("posts")]
    [InlineData("API")]
    [InlineData("404")]
    [InlineData("rss.xml")]
    public void Rejects_invalid_or_reserved_paths(string input)
    {
        var (_, error) = LoginPathRules.Normalize(input);
        Assert.NotNull(error);
    }

    [Fact]
    public void Generated_paths_are_valid_and_random()
    {
        var generated = Enumerable.Range(0, 50).Select(_ => LoginPathRules.Generate()).ToList();
        Assert.All(generated, p => Assert.Equal((p, (string?)null), LoginPathRules.Normalize(p)));
        Assert.Equal(generated.Count, generated.Distinct().Count());
    }
}

public class LoginThrottleTests
{
    private sealed class FakeClock : IClock
    {
        public DateTimeOffset UtcNow { get; set; } = new(2026, 1, 1, 0, 0, 0, TimeSpan.Zero);
    }

    [Fact]
    public void Locks_after_repeated_failures_and_doubles_each_time()
    {
        var clock = new FakeClock();
        var throttle = new LoginThrottle(clock);
        for (var i = 1; i < LoginThrottle.MaxFailures; i++)
        {
            Assert.Null(throttle.RecordFailure("1.2.3.4"));
        }

        Assert.Equal(LoginThrottle.FirstLockout, throttle.RecordFailure("1.2.3.4"));
        Assert.NotNull(throttle.LockedFor("1.2.3.4"));
        Assert.Null(throttle.LockedFor("5.6.7.8"));

        clock.UtcNow += LoginThrottle.FirstLockout + TimeSpan.FromSeconds(1);
        Assert.Null(throttle.LockedFor("1.2.3.4"));
        for (var i = 1; i < LoginThrottle.MaxFailures; i++)
        {
            throttle.RecordFailure("1.2.3.4");
        }

        Assert.Equal(LoginThrottle.FirstLockout * 2, throttle.RecordFailure("1.2.3.4"));
    }

    [Fact]
    public void Failures_outside_the_window_and_successful_logins_reset_the_count()
    {
        var clock = new FakeClock();
        var throttle = new LoginThrottle(clock);
        for (var i = 1; i < LoginThrottle.MaxFailures; i++)
        {
            throttle.RecordFailure("ip");
        }

        clock.UtcNow += LoginThrottle.Window + TimeSpan.FromSeconds(1);
        Assert.Null(throttle.RecordFailure("ip"));

        for (var i = 1; i < LoginThrottle.MaxFailures - 1; i++)
        {
            throttle.RecordFailure("ip");
        }

        throttle.Reset("ip");
        Assert.Null(throttle.RecordFailure("ip"));
        Assert.Null(throttle.LockedFor("ip"));
    }

    [Fact]
    public void Lockout_is_capped()
    {
        var clock = new FakeClock();
        var throttle = new LoginThrottle(clock);
        TimeSpan? last = null;
        for (var round = 0; round < 12; round++)
        {
            for (var i = 0; i < LoginThrottle.MaxFailures; i++)
            {
                last = throttle.RecordFailure("ip") ?? last;
            }

            clock.UtcNow += LoginThrottle.MaxLockout + TimeSpan.FromSeconds(1);
        }

        Assert.Equal(LoginThrottle.MaxLockout, last);
    }
}
