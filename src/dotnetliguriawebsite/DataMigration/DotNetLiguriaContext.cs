using System;
using System.Collections.Generic;
using System.Linq;
using System.Reflection.Metadata;
using System.Text;
using System.Threading.Tasks;

using DotNetLiguria.Models;

using Microsoft.EntityFrameworkCore;

using Microsoft.Extensions.Logging;

namespace DataMigration;

public class DotNetLiguriaContext : DbContext
{
    private readonly ILogger<DotNetLiguriaContext>? _logger;
    private static readonly ILoggerFactory _loggerFactory =
        LoggerFactory.Create(builder => { builder.AddConsole(); });
    private readonly string _connectionString   = string.Empty;

    public DotNetLiguriaContext(string connectionString)
    {
        _logger = null;
        _connectionString = connectionString;
    }

    public DotNetLiguriaContext(DbContextOptions<DotNetLiguriaContext> options,
        ILogger<DotNetLiguriaContext> logger)
        : base(options)
    {
        _logger = logger;
    }

    protected override void OnConfiguring(DbContextOptionsBuilder optionsBuilder)
    {
        if (_logger == null)
        {
            optionsBuilder.UseLoggerFactory(_loggerFactory);
            optionsBuilder.EnableSensitiveDataLogging();
            optionsBuilder.UseSqlServer(_connectionString);
        }

        base.OnConfiguring(optionsBuilder);
    }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        //modelBuilder.Conventions.Remove<PluralizingTableNameConvention>();
        modelBuilder.Entity<ImageSliderObj>().ToTable(typeof(ImageSliderObj).Name);
        modelBuilder.Entity<VideoSliderObj>().ToTable(typeof(VideoSliderObj).Name);
        modelBuilder.Entity<CustomHtmlSliderObj>().ToTable(typeof(CustomHtmlSliderObj).Name);
        modelBuilder.Entity<Workshop>().ToTable(typeof(Workshop).Name).OwnsOne(p => p.Location);

        //modelBuilder.Entity<WorkshopFile>()
        //    .HasOne<Workshop>(w => w.Workshop);
        modelBuilder.Entity<WorkshopFile>()
            //.Ignore("WorkshopId")
            .ToTable(typeof(WorkshopFile).Name);
        modelBuilder.Entity<WorkshopSpeaker>().ToTable(typeof(WorkshopSpeaker).Name);
        modelBuilder.Entity<WorkshopTrack>().ToTable(typeof(WorkshopTrack).Name);

        modelBuilder.Entity<Workshop>().HasMany<WorkshopFile>(w => w.WorkshopFiles);
    }

    public DbSet<Blog>? Blogs { get; set; }
    public DbSet<News>? News { get; set; }
    public DbSet<Workshop>? Workshops { get; set; }
    public DbSet<WorkshopFile>? WorkshopFiles { get; set; }
    public DbSet<WorkshopTrack>? Tracks { get; set; }
    public DbSet<WorkshopSpeaker>? Speakers { get; set; }
    public DbSet<HtmlSnippet>? HtmlSnippets { get; set; }
    public DbSet<Notification>? Notifications { get; set; }
    public DbSet<NewsFeed>? NewsFeed { get; set; }
    public DbSet<BlogFeed>? BlogFeed { get; set; }
    public DbSet<CustomUser>? CustomUsers { get; set; }
    public DbSet<Slider>? Sliders { get; set; }
    public DbSet<OffertaLavoro>? OfferteLavoro { get; set; }
}
