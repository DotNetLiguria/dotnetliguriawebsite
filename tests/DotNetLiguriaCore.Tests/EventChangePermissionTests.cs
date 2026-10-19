using DotNetLiguriaCore.Authorization;
using DotNetLiguriaCore.Model;
using Xunit;

namespace DotNetLiguriaCore.Tests;

public sealed class EventChangePermissionTests
{
    [Fact]
    public void UnchangedRestrictedFieldsDoNotRequireUnrelatedPowers()
    {
        var existing = new Workshop { Title = "old", Image = "image.png", FeedbackEnabled = true, In_homepage = true };
        var proposed = new Workshop { Title = "new", Image = "image.png", FeedbackEnabled = true, In_homepage = true };
        Assert.Empty(EventChangePermissions.Required(existing, proposed));
    }

    [Fact]
    public void InjectedRestrictedChangesRequireEveryCorrespondingPermission()
    {
        var required = EventChangePermissions.Required(new Workshop(), new Workshop
        {
            Published = true, In_homepage = true, FeedbackEnabled = true,
            Image = "another.png", EventbriteTicketCapacity = 100,
        });
        Assert.Equal(new[] { "event-assets.manage", "eventbrite.manage", "events.homepage.manage", "events.publish", "questionnaires.manage" },
            required.Order(StringComparer.Ordinal));
    }

    [Fact]
    public void EditingAlreadyPublishedContentIsPublication()
    {
        Assert.Contains("events.publish", EventChangePermissions.Required(
            new Workshop { Published = true, Title = "old" },
            new Workshop { Published = true, Title = "new" }));
        Assert.DoesNotContain("events.publish", EventChangePermissions.Required(
            new Workshop { Published = false, Title = "old" },
            new Workshop { Published = false, Title = "new" }));
    }
}
