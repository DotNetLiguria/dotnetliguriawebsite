using System.Net;
using System.Text;
using DotNetLiguriaCore.Services;
using Xunit;

namespace DotNetLiguriaCore.Tests;

public class SessionizeImportServiceTests
{
    [Fact]
    public async Task ImportAsync_maps_sessions_and_speakers_from_sessionize()
    {
        const string json = """
            {
              "sessions": [
                { "id": "session-1", "title": "Intro to .NET", "description": "A session", "isServiceSession": false, "speakers": ["speaker-1"] }
              ],
              "speakers": [
                { "id": "speaker-1", "fullName": "Ada Lovelace", "bio": "Engineer", "profilePicture": "https://cdn.example.test/ada.jpg" }
              ]
            }
            """;
        var handler = new SessionizeHttpMessageHandler(json);
        var service = new SessionizeImportService(new HttpClient(handler));

        var result = await service.ImportAsync("https://sessionize.com/api/v2/test123/view/All");

        Assert.Single(result.Talks);
        Assert.Equal("session-1", result.Talks[0].SessionizeId);
        Assert.Equal("talk", result.Talks[0].SessionType);
        Assert.Equal("Ada Lovelace", Assert.Single(result.Talks[0].Speakers).Name);
        Assert.Single(result.Speakers);
        Assert.Equal("speaker-1", result.Speakers[0].SessionizeId);
        Assert.Equal(HttpMethod.Get, handler.LastRequest?.Method);
        Assert.Equal("sessionize.com", handler.LastRequest?.RequestUri?.Host);
    }

    [Theory]
    [InlineData("http://sessionize.com/api/v2/test123/view/All")]
    [InlineData("https://example.com/api/v2/test123/view/All")]
    [InlineData("https://sessionize.com/api/v2/test123/view/All?host=localhost")]
    [InlineData("https://sessionize.com/api/v2/test123/view/All/../../admin")]
    public async Task ImportAsync_rejects_urls_outside_the_sessionize_api(string url)
    {
        var handler = new SessionizeHttpMessageHandler("{}");
        var service = new SessionizeImportService(new HttpClient(handler));

        await Assert.ThrowsAsync<ArgumentException>(() => service.ImportAsync(url));

        Assert.Null(handler.LastRequest);
    }
}
