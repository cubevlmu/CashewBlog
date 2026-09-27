using CashewBlog.Application.Admin;
using CashewBlog.Application.Analytics;
using CashewBlog.Application.CustomPages;
using CashewBlog.Application.Media;
using CashewBlog.Application.Posts;
using CashewBlog.Application.Settings;
using CashewBlog.Application.Taxonomy;
using Microsoft.Extensions.DependencyInjection;

namespace CashewBlog.Application;

public static class DependencyInjection
{
    public static IServiceCollection AddApplication(this IServiceCollection services)
    {
        services.AddScoped<PostContentProcessor>();
        services.AddScoped<PostService>();
        services.AddScoped<PublicPostService>();
        services.AddScoped<TaxonomyService>();
        services.AddScoped<CustomPageService>();
        services.AddScoped<MediaService>();
        services.AddScoped<SettingsService>();
        services.AddScoped<BootstrapService>();
        services.AddScoped<AnalyticsService>();
        services.AddScoped<ExportService>();
        services.AddScoped<AuthService>();
        return services;
    }
}
