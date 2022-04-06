using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BlazorQuestionarioServer.Migrations
{
    public partial class InitialCreate2 : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "Workshop",
                columns: table => new
                {
                    WorkshopId = table.Column<string>(type: "nvarchar(450)", nullable: false),
                    Title = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    Description = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    CreationDate = table.Column<DateTime>(type: "datetime2", nullable: false),
                    EventDate = table.Column<DateTime>(type: "datetime2", nullable: false),
                    BlogHtml = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    Image = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    Tags = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    Published = table.Column<bool>(type: "bit", nullable: false),
                    IsExternalEvent = table.Column<bool>(type: "bit", nullable: false),
                    ExternalRegistration = table.Column<bool>(type: "bit", nullable: false),
                    ExternalRegistrationLink = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    OnlyHtml = table.Column<bool>(type: "bit", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Workshop", x => x.WorkshopId);
                });

            migrationBuilder.CreateTable(
                name: "WorkshopSpeaker",
                columns: table => new
                {
                    WorkshopSpeakerId = table.Column<string>(type: "nvarchar(450)", nullable: false),
                    Name = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    ProfileImage = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    BlogHtml = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    UserName = table.Column<string>(type: "nvarchar(max)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_WorkshopSpeaker", x => x.WorkshopSpeakerId);
                });

            migrationBuilder.CreateTable(
                name: "WorkshopTrack",
                columns: table => new
                {
                    WorkshopTrackId = table.Column<string>(type: "nvarchar(450)", nullable: false),
                    Title = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    Image = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    StartTime = table.Column<DateTime>(type: "datetime2", nullable: false),
                    EndTime = table.Column<DateTime>(type: "datetime2", nullable: false),
                    Abstract = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    Level = table.Column<int>(type: "int", nullable: false),
                    WorkshopId = table.Column<string>(type: "nvarchar(450)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_WorkshopTrack", x => x.WorkshopTrackId);
                    table.ForeignKey(
                        name: "FK_WorkshopTrack_Workshop_WorkshopId",
                        column: x => x.WorkshopId,
                        principalTable: "Workshop",
                        principalColumn: "WorkshopId");
                });

            migrationBuilder.CreateTable(
                name: "WorkshopTrackWorkshopSpeaker",
                columns: table => new
                {
                    WorkshopTrack_WorkshopTrackId = table.Column<string>(type: "nvarchar(450)", nullable: false),
                    WorkshopSpeaker_WorkshopSpeakerId = table.Column<string>(type: "nvarchar(450)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_WorkshopTrackWorkshopSpeaker", x => new { x.WorkshopTrack_WorkshopTrackId, x.WorkshopSpeaker_WorkshopSpeakerId });
                    table.ForeignKey(
                        name: "FK_WorkshopTrackWorkshopSpeaker_WorkshopSpeaker_WorkshopSpeaker_WorkshopSpeakerId",
                        column: x => x.WorkshopSpeaker_WorkshopSpeakerId,
                        principalTable: "WorkshopSpeaker",
                        principalColumn: "WorkshopSpeakerId",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_WorkshopTrackWorkshopSpeaker_WorkshopTrack_WorkshopTrack_WorkshopTrackId",
                        column: x => x.WorkshopTrack_WorkshopTrackId,
                        principalTable: "WorkshopTrack",
                        principalColumn: "WorkshopTrackId",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_WorkshopTrack_WorkshopId",
                table: "WorkshopTrack",
                column: "WorkshopId");

            migrationBuilder.CreateIndex(
                name: "IX_WorkshopTrackWorkshopSpeaker_WorkshopSpeaker_WorkshopSpeakerId",
                table: "WorkshopTrackWorkshopSpeaker",
                column: "WorkshopSpeaker_WorkshopSpeakerId");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "WorkshopTrackWorkshopSpeaker");

            migrationBuilder.DropTable(
                name: "WorkshopSpeaker");

            migrationBuilder.DropTable(
                name: "WorkshopTrack");

            migrationBuilder.DropTable(
                name: "Workshop");
        }
    }
}
