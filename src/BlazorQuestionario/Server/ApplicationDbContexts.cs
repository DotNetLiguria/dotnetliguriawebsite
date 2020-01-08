using Microsoft.EntityFrameworkCore;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using BlazorAppTest.Shared;

namespace BlazorAppTest.Server
{
    public partial class ApplicationDbContexts : DbContext
    {
        public ApplicationDbContexts(DbContextOptions<ApplicationDbContexts> option) : base(option)
        {


        }

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            modelBuilder.Entity<WorkshopTrackWorkshopSpeaker>(entity =>
            {
                entity.HasKey(e => new { e.WorkshopTrackWorkshopTrackId, e.WorkshopSpeakerWorkshopSpeakerId });
                entity.Property(e => e.WorkshopTrackWorkshopTrackId).HasColumnName("WorkshopTrack_WorkshopTrackId");

                entity.Property(e => e.WorkshopSpeakerWorkshopSpeakerId).HasColumnName("WorkshopSpeaker_WorkshopSpeakerId");

            });



            OnModelCreatingPartial(modelBuilder);
        }
        partial void OnModelCreatingPartial(ModelBuilder modelBuilder);

        public DbSet<Workshop> Workshop { get; set; }
        public DbSet<WorkshopTrack> WorkshopTrack { get; set; }
        
        public DbSet<WorkshopSpeaker> WorkshopSpeaker { get; set; }
     
        public DbSet<WorkshopTrackWorkshopSpeaker> WorkshopTrackWorkshopSpeaker { get; set; }
        public DbSet<QuestionarioTest> QuestionarioTest { get; set; }
        
    }
}
