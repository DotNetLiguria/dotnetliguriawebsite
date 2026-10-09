using System.ComponentModel.DataAnnotations;
using System.Reflection;
using BlazorAppTest.Server;
using BlazorAppTest.Shared;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace Questionnaire.Tests;

public class ValidationTests
{
    [Fact]
    public void StartupUsesTheSuppliedConfigurationWithoutOpeningSqlite()
    {
        var configuration = new ConfigurationBuilder().AddInMemoryCollection(
            new Dictionary<string, string?> { ["ConnectionStrings:DefaultConnection-Sqlite"] = "Data Source=:memory:" }).Build();
        var services = new ServiceCollection();
        new Startup(configuration).ConfigureServices(services);
        using var provider = services.BuildServiceProvider();
        using var scope = provider.CreateScope();
        var options = scope.ServiceProvider.GetRequiredService<DbContextOptions<ApplicationDbContexts>>();
        Assert.Equal("Data Source=:memory:", Assert.Single(options.Extensions.OfType<RelationalOptionsExtension>()).ConnectionString);
    }

    [Theory]
    [InlineData(-1, false)]
    [InlineData(0, true)]
    [InlineData(10, true)]
    [InlineData(11, false)]
    public void AllSevenRatingsKeepTheTenPointRange(int rating, bool valid)
    {
        var questionnaire = new QuestionarioTest { Nome = "Test", Cognome = "User", EMail = "user@example.test", Data = new DateTime(2024, 3, 15) };
        var ratings = typeof(QuestionarioTest).GetProperties().Where(property => property.GetCustomAttribute<RangeAttribute>() is not null).ToList();
        Assert.Equal(7, ratings.Count);
        foreach (var property in ratings)
            property.SetValue(questionnaire, rating);
        Assert.Equal(valid, Validator.TryValidateObject(questionnaire, new ValidationContext(questionnaire), [], true));
    }

    [Theory]
    [InlineData("", "user@example.test", false)]
    [InlineData("Test", "not-an-email", false)]
    [InlineData("Test", "user@example.test", true)]
    public void NameAndEmailRequirementsAreEnforced(string name, string email, bool valid)
    {
        var questionnaire = new QuestionarioTest { Nome = name, Cognome = "User", EMail = email, Data = new DateTime(2024, 3, 15) };
        Assert.Equal(valid, Validator.TryValidateObject(questionnaire, new ValidationContext(questionnaire), [], true));
    }

    [Fact]
    public void NamesCannotExceedFiftyCharacters()
    {
        var questionnaire = new QuestionarioTest { Nome = new string('n', 51), Cognome = "User", EMail = "user@example.test", Data = new DateTime(2024, 3, 15) };
        var results = new List<ValidationResult>();
        Assert.False(Validator.TryValidateObject(questionnaire, new ValidationContext(questionnaire), results, true));
        Assert.Contains(results, result => result.MemberNames.Contains(nameof(QuestionarioTest.Nome)));
    }

    [Fact]
    public void CompositeKeyAndLegacyJoinColumnsAreUnchangedWithoutOpeningADatabase()
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContexts>().UseSqlServer("Server=unused;Database=unused;Integrated Security=true;TrustServerCertificate=true").Options;
        using var context = new ApplicationDbContexts(options);
        var entity = context.Model.FindEntityType(typeof(WorkshopTrackWorkshopSpeaker))!;
        Assert.Equal(["WorkshopTrackWorkshopTrackId", "WorkshopSpeakerWorkshopSpeakerId"], entity.FindPrimaryKey()!.Properties.Select(property => property.Name));
        Assert.Equal("WorkshopTrack_WorkshopTrackId", entity.FindProperty("WorkshopTrackWorkshopTrackId")!.GetColumnName());
        Assert.Equal("WorkshopSpeaker_WorkshopSpeakerId", entity.FindProperty("WorkshopSpeakerWorkshopSpeakerId")!.GetColumnName());
    }
}