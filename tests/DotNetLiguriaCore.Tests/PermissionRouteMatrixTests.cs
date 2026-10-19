using DotNetLiguriaCore.Authorization;
using Xunit;

namespace DotNetLiguriaCore.Tests;

public sealed class PermissionRouteMatrixTests
{
    [Theory]
    [InlineData("/api/Workshop/Update/{id}", "PUT", "events.manage")]
    [InlineData("/api/Workshop/Publication/{id:guid}", "PUT", "events.publish")]
    [InlineData("/api/Workshop/Homepage/{id:guid}", "PUT", "events.homepage.manage")]
    [InlineData("/api/Workshop/Delete/{id}", "DELETE", "events.delete")]
    [InlineData("/api/Workshop/PreviewSessionize/{id}", "POST", "events.read")]
    [InlineData("/api/WorkshopFile/Upload", "POST", "event-assets.manage")]
    [InlineData("/api/WorkshopFile/{workshopFileId}", "DELETE", "event-assets.delete")]
    [InlineData("/api/Speaker/ReconcileDuplicates", "POST", "speakers.merge")]
    [InlineData("/api/Speaker/RepairLegacyTrackReferences", "POST", "maintenance.speaker-references.repair")]
    [InlineData("/api/Board/Delete/{id}", "DELETE", "board.delete")]
    [InlineData("/api/Venue/{id}", "PUT", "venues.manage")]
    [InlineData("/api/TopMenu/{id}", "DELETE", "site-menu.delete")]
    [InlineData("/api/Counter/Update/{id}", "PUT", "maintenance.counters.manage")]
    [InlineData("/api/Questionnaire/{id}/publish", "POST", "questionnaires.publish")]
    [InlineData("/api/Questionnaire/{id}/close", "POST", "questionnaires.manage")]
    [InlineData("/api/Questionnaire/{id}/statistics", "GET", "questionnaire-results.read")]
    [InlineData("/api/Questionnaire/{id}/responses", "GET", "questionnaire-responses.read")]
    [InlineData("/api/Questionnaire/{id}/export", "GET", "questionnaire-responses.export")]
    [InlineData("/api/Questionnaire/{id}/responses/{responseId}", "DELETE", "questionnaire-responses.delete")]
    [InlineData("/api/Backup/export", "POST", "backups.create")]
    [InlineData("/api/Backup/import", "POST", "backups.restore")]
    [InlineData("/api/Eventbrite/Publish/{id}", "POST", "eventbrite.publish")]
    [InlineData("/api/Eventbrite/Configuration/{id:guid}", "PUT", "eventbrite.manage")]
    [InlineData("/api/Eventbrite/TicketSales/{id}", "GET", "eventbrite.read")]
    [InlineData("/api/privacy/admin/operations/{id}/identity", "GET", "privacy.identities.read")]
    [InlineData("/api/privacy/admin/operations/{id}/retry-notification", "POST", "privacy.notifications.retry")]
    [InlineData("/api/privacy/admin/retention", "PUT", "privacy.retention.manage")]
    [InlineData("/api/notifications/campaigns/preview", "POST", "notifications.preview")]
    [InlineData("/api/notifications/campaigns/{id}/confirm", "POST", "notifications.confirm")]
    public void OperationsHaveIndependentTaskPermissions(string route, string method, string permission) =>
        Assert.Equal(permission, PermissionRoutes.For(route, method));
}
