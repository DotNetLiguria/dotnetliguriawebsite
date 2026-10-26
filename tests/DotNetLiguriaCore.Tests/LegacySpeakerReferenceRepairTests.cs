using DataMigration;
using Xunit;

namespace DotNetLiguriaCore.Tests;

public sealed class LegacySpeakerReferenceRepairTests
{
    [Fact]
    public void Historical_names_are_read_only_from_the_supplied_export()
    {
        var id = Guid.Parse("cfaf983b-5d35-4a16-a7a1-508889f4666c");
        var json = $$"""
            [{"Tracks":[{"Speakers":[{"WorkshopSpeakerId":"{{id}}","Name":"Ada Lovelace"}]}]}]
            """;

        var names = LegacySpeakerReferenceRepair.ParseLegacyNames(json);

        Assert.Equal("Ada Lovelace", names[id]);
    }

    [Fact]
    public void Invalid_historical_export_is_rejected_before_database_access()
    {
        Assert.Throws<InvalidDataException>(() => LegacySpeakerReferenceRepair.ParseLegacyNames("{}"));
    }
}
