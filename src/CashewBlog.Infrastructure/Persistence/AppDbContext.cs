using CashewBlog.Application.Abstractions;
using CashewBlog.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace CashewBlog.Infrastructure.Persistence;

public sealed class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options), IApplicationDbContext
{
    public DbSet<Post> Posts => Set<Post>();
    public DbSet<Category> Categories => Set<Category>();
    public DbSet<Tag> Tags => Set<Tag>();
    public DbSet<PostTag> PostTags => Set<PostTag>();
    public DbSet<Series> Series => Set<Series>();
    public DbSet<CustomPage> CustomPages => Set<CustomPage>();
    public DbSet<MediaAsset> MediaAssets => Set<MediaAsset>();
    public DbSet<MediaReference> MediaReferences => Set<MediaReference>();
    public DbSet<PostDailyStat> PostDailyStats => Set<PostDailyStat>();
    public DbSet<PostViewDedupe> PostViewDedupes => Set<PostViewDedupe>();
    public DbSet<SiteSettingsRecord> SiteSettings => Set<SiteSettingsRecord>();
    public DbSet<SecurityAlert> SecurityAlerts => Set<SecurityAlert>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        // Trusted extension since PG13: the database owner can create it without superuser.
        modelBuilder.HasPostgresExtension("pg_trgm");

        ConfigurePost(modelBuilder.Entity<Post>());
        ConfigureTaxonomy(modelBuilder);
        ConfigureContent(modelBuilder);
        ConfigureStats(modelBuilder);
        ConfigureSecurity(modelBuilder);
    }

    private static void ConfigurePost(EntityTypeBuilder<Post> e)
    {
        e.ToTable("Posts");
        e.HasKey(p => p.Id);
        e.Property(p => p.Title).HasMaxLength(200).IsRequired();
        e.Property(p => p.Slug).HasMaxLength(200).IsRequired();
        e.HasIndex(p => p.Slug).IsUnique();
        e.Property(p => p.Description).HasMaxLength(1000);
        e.Property(p => p.ContentMarkdown).IsRequired();
        e.Property(p => p.SearchText).IsRequired().HasDefaultValue("");
        e.Property(p => p.Excerpt).IsRequired().HasDefaultValue("");
        e.Property(p => p.Status).HasConversion<short>();
        e.Property(p => p.IsPinned).HasDefaultValue(false);
        e.Property(p => p.SeoTitle).HasMaxLength(200);
        e.Property(p => p.SeoDescription).HasMaxLength(500);
        e.Property(p => p.ViewCount).HasDefaultValue(0L);

        e.HasOne(p => p.Category).WithMany().HasForeignKey(p => p.CategoryId).OnDelete(DeleteBehavior.SetNull);
        e.HasOne(p => p.Series).WithMany().HasForeignKey(p => p.SeriesId).OnDelete(DeleteBehavior.SetNull);
        e.HasOne(p => p.CoverMedia).WithMany().HasForeignKey(p => p.CoverMediaId).OnDelete(DeleteBehavior.Restrict);

        e.HasIndex(p => new { p.Status, p.PublishedAt }).IsDescending(false, true);
        e.HasIndex(p => new { p.IsPinned, p.PublishedAt }).IsDescending(true, true);
        e.HasIndex(p => p.CategoryId);
        e.HasIndex(p => p.SeriesId);
        e.HasIndex(p => p.DeletedAt);
        e.HasIndex(p => p.PurgeAt);

        // Trigram indexes accelerate ILIKE '%term%' and similarity() used by search.
        e.HasIndex(p => p.Title, "IX_Posts_Title_trgm").HasMethod("gin").HasOperators("gin_trgm_ops");
        e.HasIndex(p => p.SearchText, "IX_Posts_SearchText_trgm").HasMethod("gin").HasOperators("gin_trgm_ops");

        // Trash is invisible unless a use case opts in with IgnoreQueryFilters().
        e.HasQueryFilter(p => p.DeletedAt == null);
    }

    private static void ConfigureTaxonomy(ModelBuilder b)
    {
        b.Entity<Category>(e =>
        {
            e.ToTable("Categories");
            e.Property(c => c.Name).HasMaxLength(100).IsRequired();
            e.Property(c => c.Slug).HasMaxLength(200).IsRequired();
            e.HasIndex(c => c.Slug).IsUnique();
        });

        b.Entity<Tag>(e =>
        {
            e.ToTable("Tags");
            e.Property(t => t.Name).HasMaxLength(50).IsRequired();
            e.Property(t => t.Slug).HasMaxLength(200).IsRequired();
            e.HasIndex(t => t.Slug).IsUnique();
            e.HasIndex(t => t.Name, "IX_Tags_Name_trgm").HasMethod("gin").HasOperators("gin_trgm_ops");
        });

        b.Entity<PostTag>(e =>
        {
            e.ToTable("PostTags");
            e.HasKey(pt => new { pt.PostId, pt.TagId });
            e.HasOne(pt => pt.Post).WithMany(p => p.PostTags).HasForeignKey(pt => pt.PostId).OnDelete(DeleteBehavior.Cascade);
            e.HasOne(pt => pt.Tag).WithMany(t => t.PostTags).HasForeignKey(pt => pt.TagId).OnDelete(DeleteBehavior.Cascade);
            e.HasIndex(pt => pt.TagId);
        });

        b.Entity<Series>(e =>
        {
            e.ToTable("Series");
            e.Property(s => s.Title).HasMaxLength(200).IsRequired();
            e.Property(s => s.Slug).HasMaxLength(200).IsRequired();
            e.HasIndex(s => s.Slug).IsUnique();
            e.Property(s => s.Status).HasConversion<short>();
            e.HasOne(s => s.DefaultCategory).WithMany().HasForeignKey(s => s.DefaultCategoryId).OnDelete(DeleteBehavior.SetNull);
        });
    }

    private static void ConfigureContent(ModelBuilder b)
    {
        b.Entity<CustomPage>(e =>
        {
            e.ToTable("CustomPages");
            e.Property(p => p.Title).HasMaxLength(200).IsRequired();
            e.Property(p => p.Slug).HasMaxLength(600).IsRequired();
            e.HasIndex(p => p.Slug).IsUnique();
            e.Property(p => p.ContentHtml).IsRequired();
            e.Property(p => p.Layout).HasConversion<short>();
        });

        b.Entity<MediaAsset>(e =>
        {
            e.ToTable("MediaAssets");
            e.Property(m => m.Kind).HasConversion<short>();
            e.Property(m => m.OriginalFileName).HasMaxLength(255).IsRequired();
            e.Property(m => m.StorageName).HasMaxLength(100).IsRequired();
            e.Property(m => m.OriginalPath).HasMaxLength(300).IsRequired();
            e.Property(m => m.OptimizedPath).HasMaxLength(300);
            e.Property(m => m.ThumbnailPath).HasMaxLength(300);
            e.Property(m => m.MimeType).HasMaxLength(150).IsRequired();
            e.Property(m => m.AltText).HasMaxLength(500);
            e.Property(m => m.Sha256).HasMaxLength(64);
            e.HasIndex(m => new { m.Kind, m.CreatedAt });
            e.HasIndex(m => m.Sha256);
        });

        b.Entity<MediaReference>(e =>
        {
            e.ToTable("MediaReferences");
            e.Property(r => r.OwnerType).HasConversion<short>();
            e.Property(r => r.FieldKey).HasMaxLength(50).IsRequired();
            e.HasOne(r => r.MediaAsset).WithMany().HasForeignKey(r => r.MediaAssetId).OnDelete(DeleteBehavior.Cascade);
            e.HasIndex(r => r.MediaAssetId);
            e.HasIndex(r => new { r.OwnerType, r.OwnerId });
        });

        b.Entity<SiteSettingsRecord>(e =>
        {
            e.ToTable("SiteSettings");
            e.HasKey(s => s.Id);
            e.Property(s => s.Id).ValueGeneratedNever();
            e.Property(s => s.Data).HasColumnType("jsonb").IsRequired();
        });
    }

    private static void ConfigureStats(ModelBuilder b)
    {
        b.Entity<PostDailyStat>(e =>
        {
            e.ToTable("PostDailyStats");
            e.HasKey(s => new { s.PostId, s.Date });
            e.HasOne<Post>().WithMany().HasForeignKey(s => s.PostId).OnDelete(DeleteBehavior.Cascade);
            e.HasIndex(s => s.Date);
        });

        b.Entity<PostViewDedupe>(e =>
        {
            e.ToTable("PostViewDedupe");
            e.HasKey(d => new { d.PostId, d.VisitorHash });
            e.Property(d => d.VisitorHash).HasMaxLength(64);
            e.HasOne<Post>().WithMany().HasForeignKey(d => d.PostId).OnDelete(DeleteBehavior.Cascade);
            e.HasIndex(d => d.ExpiresAt);
        });
    }

    private static void ConfigureSecurity(ModelBuilder b)
    {
        b.Entity<SecurityAlert>(e =>
        {
            e.ToTable("SecurityAlerts");
            e.HasKey(a => a.Id);
            e.Property(a => a.Fingerprint).HasMaxLength(64).IsRequired();
            e.HasIndex(a => a.Fingerprint).IsUnique();
            e.Property(a => a.Category).HasMaxLength(64).IsRequired();
            e.Property(a => a.Severity).HasMaxLength(16).IsRequired();
            e.Property(a => a.SourceIp).HasMaxLength(64).IsRequired();
            e.Property(a => a.Path).HasMaxLength(512).IsRequired();
            e.Property(a => a.Message).HasMaxLength(512).IsRequired();
            e.HasIndex(a => new { a.AcknowledgedAt, a.LastSeenAt });
            e.HasIndex(a => a.LastSeenAt);
        });
    }
}
