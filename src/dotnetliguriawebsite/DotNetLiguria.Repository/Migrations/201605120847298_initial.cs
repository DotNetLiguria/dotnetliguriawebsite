namespace DotNetLiguria.Repository.Migrations
{
    using System;
    using System.Data.Entity.Migrations;
    
    public partial class initial : DbMigration
    {
        public override void Up()
        {
            CreateTable(
                "dbo.BlogFeed",
                c => new
                    {
                        Id = c.String(nullable: false, maxLength: 128),
                        Name = c.String(),
                        Title = c.String(),
                        Summary = c.String(),
                        Content = c.String(),
                        ImageUrl = c.String(),
                        ExtraImageUrl = c.String(),
                        MediaUrl = c.String(),
                        FeedUrl = c.String(),
                        Author = c.String(),
                        PublishDate = c.DateTime(nullable: false),
                        DefaultSummary = c.String(),
                    })
                .PrimaryKey(t => t.Id);
            
            CreateTable(
                "dbo.Blog",
                c => new
                    {
                        BlogId = c.Guid(nullable: false),
                        Title = c.String(),
                        Url = c.String(),
                        Image = c.String(),
                        Tags = c.String(),
                        Enable = c.Boolean(nullable: false),
                    })
                .PrimaryKey(t => t.BlogId);
            
            CreateTable(
                "dbo.CustomUser",
                c => new
                    {
                        CustomUserId = c.String(nullable: false, maxLength: 128),
                        Username = c.String(),
                        Email = c.String(),
                        Name = c.String(),
                        Surname = c.String(),
                        Url = c.String(),
                        Image = c.String(),
                        LastLoginDate = c.DateTime(),
                        RegistrationDate = c.DateTime(nullable: false),
                        Speaker_WorkshopSpeakerId = c.Guid(),
                    })
                .PrimaryKey(t => t.CustomUserId)
                .ForeignKey("dbo.WorkshopSpeaker", t => t.Speaker_WorkshopSpeakerId)
                .Index(t => t.Speaker_WorkshopSpeakerId);
            
            CreateTable(
                "dbo.WorkshopSpeaker",
                c => new
                    {
                        WorkshopSpeakerId = c.Guid(nullable: false),
                        Name = c.String(),
                        ProfileImage = c.String(),
                        BlogHtml = c.String(),
                        UserName = c.String(),
                    })
                .PrimaryKey(t => t.WorkshopSpeakerId);
            
            CreateTable(
                "dbo.WorkshopTrack",
                c => new
                    {
                        WorkshopTrackId = c.Guid(nullable: false),
                        Title = c.String(),
                        Image = c.String(),
                        StartTime = c.DateTime(nullable: false),
                        EndTime = c.DateTime(nullable: false),
                        Abstract = c.String(),
                        Level = c.Int(nullable: false),
                        WorkshopId = c.Guid(nullable: false),
                    })
                .PrimaryKey(t => t.WorkshopTrackId)
                .ForeignKey("dbo.Workshop", t => t.WorkshopId, cascadeDelete: true)
                .Index(t => t.WorkshopId);
            
            CreateTable(
                "dbo.HtmlSnippet",
                c => new
                    {
                        HtmlSnippetId = c.String(nullable: false, maxLength: 128),
                        Description = c.String(),
                        Value = c.String(),
                        Icon = c.String(),
                    })
                .PrimaryKey(t => t.HtmlSnippetId);
            
            CreateTable(
                "dbo.News",
                c => new
                    {
                        NewsId = c.Guid(nullable: false),
                        Title = c.String(),
                        Url = c.String(),
                        Image = c.String(),
                        Tags = c.String(),
                        Enable = c.Boolean(nullable: false),
                    })
                .PrimaryKey(t => t.NewsId);
            
            CreateTable(
                "dbo.NewsFeed",
                c => new
                    {
                        Id = c.String(nullable: false, maxLength: 128),
                        Name = c.String(),
                        Title = c.String(),
                        Summary = c.String(),
                        Content = c.String(),
                        ImageUrl = c.String(),
                        ExtraImageUrl = c.String(),
                        MediaUrl = c.String(),
                        FeedUrl = c.String(),
                        Author = c.String(),
                        PublishDate = c.DateTime(nullable: false),
                        DefaultSummary = c.String(),
                    })
                .PrimaryKey(t => t.Id);
            
            CreateTable(
                "dbo.Notification",
                c => new
                    {
                        NotificationId = c.Guid(nullable: false),
                        Timestamp = c.DateTime(nullable: false),
                        NotificationTypeId = c.Int(nullable: false),
                        Description = c.String(),
                        User_CustomUserId = c.String(maxLength: 128),
                    })
                .PrimaryKey(t => t.NotificationId)
                .ForeignKey("dbo.CustomUser", t => t.User_CustomUserId)
                .Index(t => t.User_CustomUserId);
            
            CreateTable(
                "dbo.Slider",
                c => new
                    {
                        SliderId = c.Guid(nullable: false),
                        Title = c.String(),
                        Image = c.String(),
                        SlideDelay = c.Int(nullable: false),
                        Enable = c.Boolean(nullable: false),
                        SlideTransitionType = c.Int(nullable: false),
                    })
                .PrimaryKey(t => t.SliderId);
            
            CreateTable(
                "dbo.SliderObjBase",
                c => new
                    {
                        SliderObjBaseId = c.Guid(nullable: false),
                        Top = c.String(),
                        Left = c.String(),
                        Height = c.String(),
                        Width = c.String(),
                        LayerTransitions = c.String(),
                        SliderId = c.Guid(nullable: false),
                    })
                .PrimaryKey(t => t.SliderObjBaseId)
                .ForeignKey("dbo.Slider", t => t.SliderId, cascadeDelete: true)
                .Index(t => t.SliderId);
            
            CreateTable(
                "dbo.Workshop",
                c => new
                    {
                        WorkshopId = c.Guid(nullable: false),
                        Title = c.String(),
                        Description = c.String(),
                        CreationDate = c.DateTime(nullable: false),
                        EventDate = c.DateTime(nullable: false),
                        BlogHtml = c.String(),
                        Image = c.String(),
                        Tags = c.String(),
                        Published = c.Boolean(nullable: false),
                        IsExternalEvent = c.Boolean(nullable: false),
                        ExternalRegistration = c.Boolean(nullable: false),
                        ExternalRegistrationLink = c.String(),
                        OnlyHtml = c.Boolean(nullable: false),
                        Location_Name = c.String(),
                        Location_Coordinates = c.String(),
                        Location_Address = c.String(),
                        Location_MaximumSpaces = c.Int(nullable: false),
                    })
                .PrimaryKey(t => t.WorkshopId);
            
            CreateTable(
                "dbo.WorkshopFile",
                c => new
                    {
                        WorkshopFileId = c.Guid(nullable: false),
                        Title = c.String(),
                        FileName = c.String(),
                        FullPath = c.String(),
                        FileType = c.Int(nullable: false),
                        Workshop_WorkshopId = c.Guid(),
                    })
                .PrimaryKey(t => t.WorkshopFileId)
                .ForeignKey("dbo.Workshop", t => t.Workshop_WorkshopId)
                .Index(t => t.Workshop_WorkshopId);
            
            CreateTable(
                "dbo.WorkshopUndersigned",
                c => new
                    {
                        WorkshopUndersignedId = c.Guid(nullable: false),
                        SignedDate = c.DateTime(nullable: false),
                        CheckIn = c.Boolean(nullable: false),
                        Feedback_WorkshopFeedbackId = c.Guid(),
                        User_CustomUserId = c.String(maxLength: 128),
                        Workshop_WorkshopId = c.Guid(),
                    })
                .PrimaryKey(t => t.WorkshopUndersignedId)
                .ForeignKey("dbo.WorkshopFeedback", t => t.Feedback_WorkshopFeedbackId)
                .ForeignKey("dbo.CustomUser", t => t.User_CustomUserId)
                .ForeignKey("dbo.Workshop", t => t.Workshop_WorkshopId)
                .Index(t => t.Feedback_WorkshopFeedbackId)
                .Index(t => t.User_CustomUserId)
                .Index(t => t.Workshop_WorkshopId);
            
            CreateTable(
                "dbo.WorkshopFeedback",
                c => new
                    {
                        WorkshopFeedbackId = c.Guid(nullable: false),
                        Vote = c.Int(nullable: false),
                    })
                .PrimaryKey(t => t.WorkshopFeedbackId);
            
            CreateTable(
                "dbo.TrackFeedBack",
                c => new
                    {
                        TrackFeedBackId = c.Guid(nullable: false),
                        WorkshopTrackId = c.Guid(nullable: false),
                        Vote = c.Int(nullable: false),
                        Workshopsubscribed_WorkshopFeedbackId = c.Guid(),
                    })
                .PrimaryKey(t => t.TrackFeedBackId)
                .ForeignKey("dbo.WorkshopFeedback", t => t.Workshopsubscribed_WorkshopFeedbackId)
                .Index(t => t.Workshopsubscribed_WorkshopFeedbackId);
            
            CreateTable(
                "dbo.WorkshopTrackWorkshopSpeaker",
                c => new
                    {
                        WorkshopTrack_WorkshopTrackId = c.Guid(nullable: false),
                        WorkshopSpeaker_WorkshopSpeakerId = c.Guid(nullable: false),
                    })
                .PrimaryKey(t => new { t.WorkshopTrack_WorkshopTrackId, t.WorkshopSpeaker_WorkshopSpeakerId })
                .ForeignKey("dbo.WorkshopTrack", t => t.WorkshopTrack_WorkshopTrackId, cascadeDelete: true)
                .ForeignKey("dbo.WorkshopSpeaker", t => t.WorkshopSpeaker_WorkshopSpeakerId, cascadeDelete: true)
                .Index(t => t.WorkshopTrack_WorkshopTrackId)
                .Index(t => t.WorkshopSpeaker_WorkshopSpeakerId);
            
            CreateTable(
                "dbo.ImageSliderObj",
                c => new
                    {
                        SliderObjBaseId = c.Guid(nullable: false),
                        Image = c.String(),
                        Link = c.String(),
                    })
                .PrimaryKey(t => t.SliderObjBaseId)
                .ForeignKey("dbo.SliderObjBase", t => t.SliderObjBaseId)
                .Index(t => t.SliderObjBaseId);
            
            CreateTable(
                "dbo.VideoSliderObj",
                c => new
                    {
                        SliderObjBaseId = c.Guid(nullable: false),
                        SlideVideoType = c.Int(nullable: false),
                        Source = c.String(),
                    })
                .PrimaryKey(t => t.SliderObjBaseId)
                .ForeignKey("dbo.SliderObjBase", t => t.SliderObjBaseId)
                .Index(t => t.SliderObjBaseId);
            
            CreateTable(
                "dbo.CustomHtmlSliderObj",
                c => new
                    {
                        SliderObjBaseId = c.Guid(nullable: false),
                        InnerHtml = c.String(),
                    })
                .PrimaryKey(t => t.SliderObjBaseId)
                .ForeignKey("dbo.SliderObjBase", t => t.SliderObjBaseId)
                .Index(t => t.SliderObjBaseId);
            
        }
        
        public override void Down()
        {
            DropForeignKey("dbo.CustomHtmlSliderObj", "SliderObjBaseId", "dbo.SliderObjBase");
            DropForeignKey("dbo.VideoSliderObj", "SliderObjBaseId", "dbo.SliderObjBase");
            DropForeignKey("dbo.ImageSliderObj", "SliderObjBaseId", "dbo.SliderObjBase");
            DropForeignKey("dbo.WorkshopUndersigned", "Workshop_WorkshopId", "dbo.Workshop");
            DropForeignKey("dbo.WorkshopUndersigned", "User_CustomUserId", "dbo.CustomUser");
            DropForeignKey("dbo.WorkshopUndersigned", "Feedback_WorkshopFeedbackId", "dbo.WorkshopFeedback");
            DropForeignKey("dbo.TrackFeedBack", "Workshopsubscribed_WorkshopFeedbackId", "dbo.WorkshopFeedback");
            DropForeignKey("dbo.WorkshopFile", "Workshop_WorkshopId", "dbo.Workshop");
            DropForeignKey("dbo.WorkshopTrack", "WorkshopId", "dbo.Workshop");
            DropForeignKey("dbo.SliderObjBase", "SliderId", "dbo.Slider");
            DropForeignKey("dbo.Notification", "User_CustomUserId", "dbo.CustomUser");
            DropForeignKey("dbo.CustomUser", "Speaker_WorkshopSpeakerId", "dbo.WorkshopSpeaker");
            DropForeignKey("dbo.WorkshopTrackWorkshopSpeaker", "WorkshopSpeaker_WorkshopSpeakerId", "dbo.WorkshopSpeaker");
            DropForeignKey("dbo.WorkshopTrackWorkshopSpeaker", "WorkshopTrack_WorkshopTrackId", "dbo.WorkshopTrack");
            DropIndex("dbo.CustomHtmlSliderObj", new[] { "SliderObjBaseId" });
            DropIndex("dbo.VideoSliderObj", new[] { "SliderObjBaseId" });
            DropIndex("dbo.ImageSliderObj", new[] { "SliderObjBaseId" });
            DropIndex("dbo.WorkshopTrackWorkshopSpeaker", new[] { "WorkshopSpeaker_WorkshopSpeakerId" });
            DropIndex("dbo.WorkshopTrackWorkshopSpeaker", new[] { "WorkshopTrack_WorkshopTrackId" });
            DropIndex("dbo.TrackFeedBack", new[] { "Workshopsubscribed_WorkshopFeedbackId" });
            DropIndex("dbo.WorkshopUndersigned", new[] { "Workshop_WorkshopId" });
            DropIndex("dbo.WorkshopUndersigned", new[] { "User_CustomUserId" });
            DropIndex("dbo.WorkshopUndersigned", new[] { "Feedback_WorkshopFeedbackId" });
            DropIndex("dbo.WorkshopFile", new[] { "Workshop_WorkshopId" });
            DropIndex("dbo.SliderObjBase", new[] { "SliderId" });
            DropIndex("dbo.Notification", new[] { "User_CustomUserId" });
            DropIndex("dbo.WorkshopTrack", new[] { "WorkshopId" });
            DropIndex("dbo.CustomUser", new[] { "Speaker_WorkshopSpeakerId" });
            DropTable("dbo.CustomHtmlSliderObj");
            DropTable("dbo.VideoSliderObj");
            DropTable("dbo.ImageSliderObj");
            DropTable("dbo.WorkshopTrackWorkshopSpeaker");
            DropTable("dbo.TrackFeedBack");
            DropTable("dbo.WorkshopFeedback");
            DropTable("dbo.WorkshopUndersigned");
            DropTable("dbo.WorkshopFile");
            DropTable("dbo.Workshop");
            DropTable("dbo.SliderObjBase");
            DropTable("dbo.Slider");
            DropTable("dbo.Notification");
            DropTable("dbo.NewsFeed");
            DropTable("dbo.News");
            DropTable("dbo.HtmlSnippet");
            DropTable("dbo.WorkshopTrack");
            DropTable("dbo.WorkshopSpeaker");
            DropTable("dbo.CustomUser");
            DropTable("dbo.Blog");
            DropTable("dbo.BlogFeed");
        }
    }
}
