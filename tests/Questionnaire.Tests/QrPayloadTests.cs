using BlazorAppTest.Server;
using BlazorAppTest.Server.Controllers;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace Questionnaire.Tests;

public class QrPayloadTests
{
    [Theory]
    [InlineData("prefix-rest", "prefix", true)]
    [InlineData("prefix-rest", "other", false)]
    [InlineData("prefix-rest", "PREFIX", false)]
    [InlineData("prefix-rest", "", true)]
    [InlineData(null, "prefix", false)]
    [InlineData("prefix-rest", null, false)]
    public void WorkshopMatchingPreservesExistingPrefixSemantics(string? workshopId, string? payload, bool expected)
    {
        Assert.Equal(expected, QrPayload.MatchesWorkshop(workshopId!, payload!));
    }

    [Theory]
    [InlineData(0)]
    [InlineData(2)]
    public void InvalidUploadCountsReturnNotFoundWithoutQueryingPersistence(int count)
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContexts>().UseSqlServer("Server=unused;Database=unused;Integrated Security=true;TrustServerCertificate=true").Options;
        using var database = new ApplicationDbContexts(options);
        using var stream = new MemoryStream([0]);
        var files = new FormFileCollection();
        for (var index = 0; index < count; index++)
            files.Add(new FormFile(stream, 0, 1, "file", "fixture.png"));
        var context = new DefaultHttpContext();
        context.Request.Form = new FormCollection(new Dictionary<string, Microsoft.Extensions.Primitives.StringValues>(), files);
        var controller = new QRController(database) { ControllerContext = new ControllerContext { HttpContext = context } };
        Assert.IsType<NotFoundResult>(controller.Capture("fixture"));
    }
}