using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BlazorQuestionarioServer.Migrations
{
    public partial class InitialCreate : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "QuestionarioTest",
                columns: table => new
                {
                    QuestionarioTestId = table.Column<string>(type: "nvarchar(450)", nullable: false),
                    Data = table.Column<DateTime>(type: "datetime2", nullable: false),
                    Nome = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    Cognome = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    EMail = table.Column<string>(type: "nvarchar(250)", maxLength: 250, nullable: false),
                    ArgomentiProxEvento = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    ValutazioneQualitaGeneraleEvento = table.Column<int>(type: "int", nullable: false),
                    UtilitaInformazioniRicevute = table.Column<int>(type: "int", nullable: false),
                    WorkshopId = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    Track01WorkshopTrackId = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    Track01Valutazione = table.Column<int>(type: "int", nullable: false),
                    Track02WorkshopTrackId = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    Track02Valutazione = table.Column<int>(type: "int", nullable: false),
                    Track03WorkshopTrackId = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    Track03Valutazione = table.Column<int>(type: "int", nullable: false),
                    Track04WorkshopTrackId = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    Track04Valutazione = table.Column<int>(type: "int", nullable: false),
                    Track05WorkshopTrackId = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    Track05Valutazione = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_QuestionarioTest", x => x.QuestionarioTestId);
                });
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "QuestionarioTest");
        }
    }
}
