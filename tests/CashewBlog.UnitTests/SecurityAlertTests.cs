using CashewBlog.Infrastructure.Security;

namespace CashewBlog.UnitTests;

public sealed class SecurityAlertTests
{
    [Fact]
    public void Fingerprint_is_stable_and_changes_with_route()
    {
        var first = SecurityAlertRecorder.CreateFingerprint("RouteProbe", "127.0.0.1", "/.env");
        Assert.Equal(first, SecurityAlertRecorder.CreateFingerprint("RouteProbe", "127.0.0.1", "/.env"));
        Assert.NotEqual(first, SecurityAlertRecorder.CreateFingerprint("RouteProbe", "127.0.0.1", "/wp-login.php"));
    }

    [Fact]
    public void Attacker_controlled_values_are_bounded()
    {
        Assert.Equal("unknown", SecurityAlertRecorder.Limit(" ", 10));
        Assert.Equal(10, SecurityAlertRecorder.Limit(new string('x', 30), 10).Length);
    }
}
