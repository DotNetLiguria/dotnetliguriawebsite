namespace DotNetLiguria.Repository.Migrations
{
    using System;
    using System.Data.Entity.Migrations;
    
    public partial class lavoro : DbMigration
    {
        public override void Up()
        {
            CreateTable(
                "dbo.OffertaLavoro",
                c => new
                    {
                        OffertaLavoroId = c.Guid(nullable: false),
                        Title = c.String(),
                        Description = c.String(),
                        CreationDate = c.DateTime(nullable: false),
                        Logo = c.String(),
                        Link = c.String(),
                        Enable = c.Boolean(nullable: false),
                        BlogHtml = c.String(),
                        Azienda = c.String(),
                        Luogo = c.String(),
                        User_CustomUserId = c.String(maxLength: 128),
                    })
                .PrimaryKey(t => t.OffertaLavoroId)
                .ForeignKey("dbo.CustomUser", t => t.User_CustomUserId)
                .Index(t => t.User_CustomUserId);
            
        }
        
        public override void Down()
        {
            DropForeignKey("dbo.OffertaLavoro", "User_CustomUserId", "dbo.CustomUser");
            DropIndex("dbo.OffertaLavoro", new[] { "User_CustomUserId" });
            DropTable("dbo.OffertaLavoro");
        }
    }
}
