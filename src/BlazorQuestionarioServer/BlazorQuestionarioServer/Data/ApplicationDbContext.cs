using BlazorAppTest.Shared;
using Microsoft.EntityFrameworkCore;

namespace BlazorQuestionarioServer.Data
{

    public class ApplicationDbContext : DbContext
    {
        public ApplicationDbContext(DbContextOptions<ApplicationDbContext> option) : base(option)
        {


        }

        public virtual DbSet<QuestionarioTest> QuestionarioTest { get; set; }
        public virtual DbSet<Workshop> Workshop { get; set; }
        public virtual DbSet<WorkshopSpeaker> WorkshopSpeaker { get; set; }
        public virtual DbSet<WorkshopTrack> WorkshopTrack { get; set; }
        public virtual DbSet<WorkshopTrackWorkshopSpeaker> WorkshopTrackWorkshopSpeaker { get; set; }
        public virtual DbSet<WorkshopCorrente> WorkshopCorrente { get; set; }
        


        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            modelBuilder.Entity<QuestionarioTest>(entity =>
            {
                entity.HasKey(e => e.QuestionarioTestId);
                

            });

            modelBuilder.Entity<WorkshopTrackWorkshopSpeaker>(entity =>
            {
                entity.HasKey(e => new { e.WorkshopTrackWorkshopTrackId, e.WorkshopSpeakerWorkshopSpeakerId });
                entity.Property(e => e.WorkshopTrackWorkshopTrackId).HasColumnName("WorkshopTrack_WorkshopTrackId");

                entity.Property(e => e.WorkshopSpeakerWorkshopSpeakerId).HasColumnName("WorkshopSpeaker_WorkshopSpeakerId");

            });

            base.OnModelCreating(modelBuilder);



        }


    }
}
