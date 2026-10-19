using DotNetLiguriaCore.Services;
using DotNetLiguriaCore.Endpoints;
using DotNetLiguriaCore.Model;
using DotNetLiguriaCore.Services.Privacy;
using Xunit;

namespace DotNetLiguriaCore.Tests;

public sealed class EventbriteSalesTimesTests
{
    [Fact]
    public void ConfigurationChangesOnlyTheSalesWindowAndPendingSyncState()
    {
        var workshop = new Workshop
        {
            Title = "Unchanged", Published = true, In_homepage = true,
            EventbriteEventId = "event", EventbriteTicketCapacity = 42, EventbriteSyncStatus = "synced",
        };
        new EventbriteConfigurationRequest("2026-07-01T10:00", null).ApplyTo(workshop);
        Assert.Equal("2026-07-01T10:00", workshop.EventbriteSalesStart);
        Assert.Null(workshop.EventbriteSalesEnd);
        Assert.Equal("update-pending", workshop.EventbriteSyncStatus);
        Assert.Equal("Unchanged", workshop.Title);
        Assert.True(workshop.Published);
        Assert.True(workshop.In_homepage);
        Assert.Equal(42, workshop.EventbriteTicketCapacity);
    }

    [Theory]
    [InlineData("creating-event")]
    [InlineData("creating-ticket")]
    [InlineData("reconciliation-required")]
    public void ConfigurationCannotResetAnUncertainProviderOutcome(string status)
    {
        var workshop = new Workshop { EventbriteSyncStatus = status, EventbriteSalesStart = "original" };
        Assert.Equal("eventbrite_reconciliation_required", Assert.Throws<PrivacyBlockedException>(
            () => new EventbriteConfigurationRequest(null, null).ApplyTo(workshop)).Code);
        Assert.Equal("original", workshop.EventbriteSalesStart);
        Assert.Equal(status, workshop.EventbriteSyncStatus);
    }

    [Fact]
    public void TicketingSpecialistsCanConfigureInitialCapacityWithoutCreatingAProviderTicket()
    {
        var workshop = new Workshop();
        new EventbriteConfigurationRequest(null, null, 42).ApplyTo(workshop);
        Assert.Equal(42, workshop.EventbriteTicketCapacity);
    }

    [Fact]
    public void ExistingTicketCapacityCannotBypassLiveSoldAndPendingVerification()
    {
        var workshop = new Workshop
        {
            EventbriteTicketClassId = "ticket", EventbriteTicketCapacity = 42,
            EventbriteSalesStart = "original",
        };
        Assert.Equal("eventbrite_capacity_requires_live_verification", Assert.Throws<PrivacyBlockedException>(
            () => new EventbriteConfigurationRequest(null, null, 43).ApplyTo(workshop)).Code);
        Assert.Equal(42, workshop.EventbriteTicketCapacity);
        Assert.Equal("original", workshop.EventbriteSalesStart);
    }

    [Fact]
    public void NegativeInitialCapacityIsRejectedBeforeMutation()
    {
        var workshop = new Workshop();
        Assert.Equal("eventbrite_capacity_invalid", Assert.Throws<PrivacyBlockedException>(
            () => new EventbriteConfigurationRequest(null, null, -1).ApplyTo(workshop)).Code);
        Assert.Equal(0, workshop.EventbriteTicketCapacity);
    }

    [Fact]
    public void LocalSalesWindowUsesTheConfiguredTimeZone()
    {
        var zone = TimeZoneInfo.FindSystemTimeZoneById("Europe/Rome");
        Assert.Equal(("2026-07-01T08:00:00Z", "2026-07-01T10:00:00Z"),
            EventbriteSalesTimes.ToUtc("2026-07-01T10:00", "2026-07-01T12:00", zone));
        Assert.Equal((null, null), EventbriteSalesTimes.ToUtc(null, "", zone));
    }

    [Theory]
    [InlineData("2026-07-01T12:00", "2026-07-01T10:00")]
    [InlineData("2026-07-01T10:00", "2026-07-01T10:00")]
    [InlineData("2026-03-29T02:30", null)]
    [InlineData("2026-10-25T02:30", null)]
    [InlineData("invalid", null)]
    [InlineData("2026-07-01T10:00:00Z", null)]
    public void InvalidOrAmbiguousSalesWindowsAreRejected(string start, string? end) =>
        Assert.Throws<ArgumentException>(() => EventbriteSalesTimes.ToUtc(
            start, end, TimeZoneInfo.FindSystemTimeZoneById("Europe/Rome")));
}
