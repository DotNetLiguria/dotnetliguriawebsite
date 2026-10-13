using System.Text.Json;
using DotNetLiguriaCore.Model;
using Xunit;

namespace DotNetLiguriaCore.Tests;

public class SpeakerIdentityTests
{
    [Theory]
    [InlineData("  José   García ", "JOSE GARCIA")]
    [InlineData("Ada Lovelace", "ADA LOVELACE")]
    [InlineData(null, "")]
    public void NormalizeName_collapses_whitespace_and_ignores_case_and_accents(string? name, string expected)
    {
        Assert.Equal(expected, SpeakerIdentity.NormalizeName(name));
    }

    [Fact]
    public void Merge_keeps_guid_and_sessionize_identity_and_fills_missing_manual_fields()
    {
        var importedId = Guid.NewGuid();
        var manual = new WorkshopSpeaker
        {
            WorkshopSpeakerId = Guid.NewGuid(),
            Name = "Grace Hopper",
            Email = "grace@example.test",
            Description = "Local biography",
            IsActive = true
        };
        var imported = new WorkshopSpeaker
        {
            WorkshopSpeakerId = importedId,
            Name = "Grace Hopper",
            SessionizeId = "sessionize-1",
            ProfileImageUrl = "https://example.test/grace.jpg",
            IsActive = false
        };

        var merged = SpeakerIdentity.Merge([manual, imported]);

        Assert.Equal(importedId, merged.WorkshopSpeakerId);
        Assert.Equal("sessionize-1", merged.SessionizeId);
        Assert.Equal("grace@example.test", merged.Email);
        Assert.Equal("Local biography", merged.Description);
        Assert.Equal("https://example.test/grace.jpg", merged.ProfileImageUrl);
        Assert.True(merged.IsActive);
        Assert.Equal("GRACE HOPPER", merged.NormalizedName);
    }

    [Fact]
    public void NormalizedName_is_not_added_to_the_public_json_contract()
    {
        var json = JsonSerializer.Serialize(new WorkshopSpeaker
        {
            WorkshopSpeakerId = Guid.NewGuid(),
            Name = "Ada Lovelace",
            NormalizedName = "ADA LOVELACE"
        });

        Assert.DoesNotContain("NormalizedName", json, StringComparison.Ordinal);
    }

    [Fact]
    public void ApplySessionize_overwrites_imported_fields_and_preserves_the_guid_and_email()
    {
        var id = Guid.NewGuid();
        var existing = new WorkshopSpeaker
        {
            WorkshopSpeakerId = id,
            Name = "Ada Lovelace",
            Email = "ada@example.test",
            Description = "Manual biography",
            IsActive = false
        };
        var imported = new WorkshopSpeaker
        {
            WorkshopSpeakerId = Guid.NewGuid(),
            SessionizeId = "sessionize-ada",
            Name = "Augusta Ada Lovelace",
            ProfileImageUrl = "https://example.test/ada.jpg",
            Description = "Imported biography",
            IsActive = true
        };

        var updated = SpeakerIdentity.ApplySessionize(existing, imported, overwrite: true);

        Assert.Equal(id, updated.WorkshopSpeakerId);
        Assert.Equal("sessionize-ada", updated.SessionizeId);
        Assert.Equal("Augusta Ada Lovelace", updated.Name);
        Assert.Equal("https://example.test/ada.jpg", updated.ProfileImageUrl);
        Assert.Equal("Imported biography", updated.Description);
        Assert.Equal("ada@example.test", updated.Email);
        Assert.True(updated.IsActive);
    }

    [Fact]
    public void ApplySessionize_keeps_local_fields_when_overwrite_is_declined_and_links_import_id()
    {
        var id = Guid.NewGuid();
        var existing = new WorkshopSpeaker
        {
            WorkshopSpeakerId = id,
            Name = "Grace Hopper",
            Email = "grace@example.test",
            Description = "Local biography",
            IsActive = false
        };
        var imported = new WorkshopSpeaker
        {
            SessionizeId = "sessionize-grace",
            Name = "Grace Hopper",
            Description = "Imported biography",
            IsActive = true
        };

        var updated = SpeakerIdentity.ApplySessionize(existing, imported, overwrite: false);

        Assert.Equal(id, updated.WorkshopSpeakerId);
        Assert.Equal("sessionize-grace", updated.SessionizeId);
        Assert.Equal("Grace Hopper", updated.Name);
        Assert.Equal("Local biography", updated.Description);
        Assert.Equal("grace@example.test", updated.Email);
        Assert.False(updated.IsActive);
    }
}
