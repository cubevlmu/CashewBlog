using CashewBlog.Application.Setup;
using Npgsql;

namespace CashewBlog.IntegrationTests.Infrastructure;

/// <summary>
/// A uniquely named database on the disposable test cluster (see tests/scripts/start-test-postgres.sh).
/// Override the server with the CASHEWBLOG_TEST_PG environment variable (any database name in it is
/// ignored; a fresh <c>cashewblog_test_*</c> database is created and dropped per test class).
/// </summary>
public sealed class TestDatabase : IAsyncDisposable
{
    private const string DefaultServer = "Host=127.0.0.1;Port=55432;Username=postgres";

    private TestDatabase(string name) => Name = name;

    public string Name { get; }

    public static NpgsqlConnectionStringBuilder Server
    {
        get
        {
            var builder = new NpgsqlConnectionStringBuilder(Environment.GetEnvironmentVariable("CASHEWBLOG_TEST_PG") ?? DefaultServer);
            builder.Database = "postgres";
            builder.Pooling = false;
            return builder;
        }
    }

    public string ConnectionString
    {
        get
        {
            var builder = Server;
            builder.Database = Name;
            return builder.ConnectionString;
        }
    }

    public DatabaseConfig ToConfig()
    {
        var server = Server;
        return new DatabaseConfig
        {
            Host = server.Host!,
            Port = server.Port,
            Database = Name,
            Username = server.Username!,
            Password = server.Password ?? "",
            SslMode = "Disable",
        };
    }

    public static async Task<TestDatabase> CreateAsync()
    {
        var db = new TestDatabase($"cashewblog_test_{Guid.NewGuid():N}"[..32]);
        await using var connection = new NpgsqlConnection(Server.ConnectionString);
        try
        {
            await connection.OpenAsync();
        }
        catch (Exception ex)
        {
            throw new InvalidOperationException(
                $"Cannot connect to the test PostgreSQL server ({Server.Host}:{Server.Port}). " +
                "Start it with tests/scripts/start-test-postgres.sh or set CASHEWBLOG_TEST_PG.", ex);
        }

        await using var cmd = new NpgsqlCommand($"CREATE DATABASE \"{db.Name}\" ENCODING 'UTF8' TEMPLATE template0", connection);
        await cmd.ExecuteNonQueryAsync();
        return db;
    }

    public async ValueTask DisposeAsync()
    {
        NpgsqlConnection.ClearAllPools();
        await using var connection = new NpgsqlConnection(Server.ConnectionString);
        await connection.OpenAsync();
        await using var cmd = new NpgsqlCommand($"DROP DATABASE IF EXISTS \"{Name}\" WITH (FORCE)", connection);
        await cmd.ExecuteNonQueryAsync();
    }
}
