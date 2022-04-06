using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BlazorQuestionarioServer.Migrations
{
    public partial class InitialCreate3 : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "WorkshopCorrente",
                columns: table => new
                {
                    WorkshopId = table.Column<string>(type: "nvarchar(450)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_WorkshopCorrente", x => x.WorkshopId);
                });
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "WorkshopCorrente");
        }
    }
}
