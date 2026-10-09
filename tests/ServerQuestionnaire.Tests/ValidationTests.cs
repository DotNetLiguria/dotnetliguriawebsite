using System.ComponentModel.DataAnnotations;
using BlazorAppTest.Shared;
using BlazorQuestionarioServer.Data;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace ServerQuestionnaire.Tests;

public class ValidationTests
{
    [Theory]
    [InlineData(-1, false)]
    [InlineData(0, true)]
    [InlineData(5, true)]
    [InlineData(6, false)]
    public void EventAndFirstThreeTrackRatingsKeepTheFivePointRange(int rating, bool valid)
    {
        var questionnaire = new QuestionarioTest
        {
            Nome = "Test", Cognome = "User", EMail = "user@example.test",
            Data = new DateTime(2024, 3, 15), ValutazioneQualitaGeneraleEvento = rating,
            Track01Valutazione = rating, Track02Valutazione = rating, Track03Valutazione = rating
        };
        Assert.Equal(valid, Validator.TryValidateObject(questionnaire, new ValidationContext(questionnaire), [], true));
    }

    [Fact]
    public void LastTwoTracksRetainTheirHistoricalTenPointRange()
    {
        var questionnaire = new QuestionarioTest { Nome = "Test", Cognome = "User", EMail = "user@example.test", Track04Valutazione = 10, Track05Valutazione = 10 };
        Assert.True(Validator.TryValidateObject(questionnaire, new ValidationContext(questionnaire), [], true));
    }

    [Fact]
    public void CompositeKeyAndLegacyJoinColumnsAreUnchangedWithoutOpeningADatabase()
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>().UseSqlServer("Server=unused;Database=unused;Integrated Security=true;TrustServerCertificate=true").Options;
        using var context = new ApplicationDbContext(options);
        var entity = context.Model.FindEntityType(typeof(WorkshopTrackWorkshopSpeaker))!;
        Assert.Equal(["WorkshopTrackWorkshopTrackId", "WorkshopSpeakerWorkshopSpeakerId"], entity.FindPrimaryKey()!.Properties.Select(property => property.Name));
        Assert.Equal("WorkshopTrack_WorkshopTrackId", entity.FindProperty("WorkshopTrackWorkshopTrackId")!.GetColumnName());
        Assert.Equal("WorkshopSpeaker_WorkshopSpeakerId", entity.FindProperty("WorkshopSpeakerWorkshopSpeakerId")!.GetColumnName());
    }
}