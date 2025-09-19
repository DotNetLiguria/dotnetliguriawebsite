using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BlazorQuestionarioServer.Migrations
{
    public partial class InitialCreate : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "ConsigliSuggerimenti",
                table: "QuestionarioTest",
                type: "nvarchar(max)",
                nullable: true);
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "ConsigliSuggerimenti",
                table: "QuestionarioTest");
        }
    }
}
