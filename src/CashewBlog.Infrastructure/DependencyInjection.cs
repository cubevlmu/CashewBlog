using CashewBlog.Application.Abstractions;
using CashewBlog.Application.Admin;
using CashewBlog.Application.Analytics;
using CashewBlog.Application.Common;
using CashewBlog.Application.Search;
using CashewBlog.Application.Setup;
using CashewBlog.Infrastructure.Analytics;
using CashewBlog.Infrastructure.Configuration;
using CashewBlog.Infrastructure.Content;
using CashewBlog.Infrastructure.Jobs;
using CashewBlog.Infrastructure.Media;
using CashewBlog.Infrastructure.Persistence;
using CashewBlog.Infrastructure.Search;
using CashewBlog.Infrastructure.Security;
using CashewBlog.Infrastructure.Setup;
using CashewBlog.Infrastructure.SystemInfo;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.DependencyInjection;

namespace CashewBlog.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(this IServiceCollection services, RuntimePaths paths, MaintenanceOptions maintenance)
    {
        services.AddSingleton(paths);
        services.AddSingleton<JsonConfigStore>();
        services.AddSingleton<IConfigStore>(sp => sp.GetRequiredService<JsonConfigStore>());

        // The connection string is resolved per scope from the config store, so completing
        // setup switches the running process to the new database without a restart.
        services.AddDbContext<AppDbContext>((sp, options) =>
        {
            var connectionString = sp.GetRequiredService<IConfigStore>().ConnectionString ?? throw new SetupRequiredException();
            options.UseNpgsql(connectionString);
            options.ConfigureWarnings(w => w.Ignore(CoreEventId.PossibleIncorrectRequiredNavigationWithQueryFilterInteractionWarning));
        });
        services.AddScoped<IApplicationDbContext>(sp => sp.GetRequiredService<AppDbContext>());

        services.AddSingleton<IClock, SystemClock>();
        services.AddSingleton<IPasswordHasher, Argon2PasswordHasher>();
        services.AddSingleton<IVisitorPepper, FileVisitorPepper>();
        services.AddSingleton<IMarkdownTextExtractor, MarkdigTextExtractor>();
        services.AddSingleton<IHtmlSanitizerService, CustomPageHtmlSanitizer>();
        services.AddSingleton<IMediaStorage, LocalMediaStorage>();
        services.AddSingleton<IImageProcessor, ImageSharpProcessor>();
        services.AddSingleton<CpuSampler>();
        services.AddSingleton<RuntimeVersionProbe>();

        services.AddScoped<ISearchService, PgSearchService>();
        services.AddScoped<IViewRecorder, PgViewRecorder>();
        services.AddScoped<ISystemInfoService, SystemInfoService>();
        services.AddScoped<ISetupService, SetupService>();

        services.AddSingleton(maintenance);
        services.AddHostedService<MaintenanceService>();
        return services;
    }
}
