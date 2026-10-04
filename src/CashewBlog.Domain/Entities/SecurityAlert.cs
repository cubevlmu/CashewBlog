namespace CashewBlog.Domain.Entities;

/// <summary>One aggregated security incident reported by the gateway.</summary>
public sealed class SecurityAlert
{
    public long Id { get; set; }
    public string Fingerprint { get; set; } = "";
    public string Category { get; set; } = "";
    public string Severity { get; set; } = "Warning";
    public string SourceIp { get; set; } = "";
    public string Path { get; set; } = "";
    public string Message { get; set; } = "";
    public int Count { get; set; } = 1;
    public DateTimeOffset FirstSeenAt { get; set; }
    public DateTimeOffset LastSeenAt { get; set; }
    public DateTimeOffset? AcknowledgedAt { get; set; }
}
