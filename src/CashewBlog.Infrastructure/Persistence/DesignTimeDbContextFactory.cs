using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace CashewBlog.Infrastructure.Persistence;

/// <summary>Used only by <c>dotnet ef</c>; no database connection is made when adding migrations.</summary>
public sealed class DesignTimeDbContextFactory : IDesignTimeDbContextFactory<AppDbContext>
{
    public AppDbContext CreateDbContext(string[] args)
    {
        var connectionString = Environment.GetEnvironmentVariable("CASHEWBLOG_DESIGN_PG")
            ?? "Host=localhost;Database=cashewblog_design;Username=postgres";
        var options = new DbContextOptionsBuilder<AppDbContext>().UseNpgsql(connectionString).Options;
        return new AppDbContext(options);
    }
}
