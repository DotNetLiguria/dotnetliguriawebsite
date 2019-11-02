using DotNetLiguria.Repository.Migrations;
using DotNetLiguria.Models;
using System;
using System.Data.Common;
using System.Data.Entity;
using System.Data.Entity.Infrastructure;
using System.Data.Entity.Migrations;
using System.Data.Entity.Migrations.Infrastructure;
using System.Data.Entity.ModelConfiguration.Conventions;
using System.Linq;

namespace DotNetLiguria.Repository
{
    public class DotNetLiguriaContext : DbContext
    {
        //private static ILog log = log4net.LogManager.GetLogger(typeof(DotNetLiguriaContext));

        public DotNetLiguriaContext()
            : base("name=DotNetLiguriaContext")
        {
            //Configuration.LazyLoadingEnabled = true;
            //Configuration.ProxyCreationEnabled = true;
            //Configuration.AutoDetectChangesEnabled = true;
            //Configuration.ValidateOnSaveEnabled = true;
        }

        public static void CreateDb()
        {
            //log.InfoFormat("Create Database Starting (Only if Not Exist...)");

            using (var context = new DotNetLiguriaContext())
            {
                Database.SetInitializer<DotNetLiguriaContext>(new CreateDatabaseIfNotExists<DotNetLiguriaContext>());
            }

            Database.SetInitializer<DotNetLiguriaContext>(null);

            //log.Info("Database READY");
            //log.Info("-----------------------------------------------------------------------------------------------------------------------");
        }

        public void Migration()
        {
            new CustomInitializer().InitializeDatabase(this);
        }

        protected override void OnModelCreating(DbModelBuilder modelBuilder)
        {
            Database.SetInitializer<DotNetLiguriaContext>(null);
            base.OnModelCreating(modelBuilder);

            modelBuilder.Conventions.Remove<PluralizingTableNameConvention>();

            modelBuilder.Entity<ImageSliderObj>().ToTable(typeof(ImageSliderObj).Name);
            modelBuilder.Entity<VideoSliderObj>().ToTable(typeof(VideoSliderObj).Name);
            modelBuilder.Entity<CustomHtmlSliderObj>().ToTable(typeof(CustomHtmlSliderObj).Name);
        }

        public DbSet<Blog> Blogs { get; set; }
        public DbSet<News> News { get; set; }
        public DbSet<Workshop> Workshops { get; set; }
        public DbSet<WorkshopTrack> Tracks { get; set; }
        public DbSet<WorkshopSpeaker> Speakers { get; set; }
        public DbSet<HtmlSnippet> HtmlSnippets { get; set; }
        public DbSet<Notification> Notifications { get; set; }
        public DbSet<NewsFeed> NewsFeed { get; set; }
        public DbSet<BlogFeed> BlogFeed { get; set; }
        public DbSet<CustomUser> CustomUsers { get; set; }
        public DbSet<Slider> Sliders { get; set; }
        public DbSet<OffertaLavoro> OfferteLavoro { get; set; }
    }

}