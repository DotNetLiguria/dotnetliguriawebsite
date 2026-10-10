using System.Text.Json;
using DotNetLiguriaCore.Model;

namespace DotNetLiguriaCore.Services;

public class SessionizeImportService(HttpClient httpClient)
{
    public async Task<SessionizeImportData> ImportAsync(string? sessionizeUrl, CancellationToken cancellationToken = default)
    {
        if (!TryGetValidatedUrl(sessionizeUrl, out var url) || url is null)
        {
            throw new ArgumentException("Use a Sessionize URL in the form https://sessionize.com/api/v2/{id}/view/All.", nameof(sessionizeUrl));
        }

        using var response = await httpClient.GetAsync(url, cancellationToken);
        response.EnsureSuccessStatusCode();
        await using var responseStream = await response.Content.ReadAsStreamAsync(cancellationToken);
        using var document = await JsonDocument.ParseAsync(responseStream, cancellationToken: cancellationToken);
        var root = document.RootElement;
        if (root.ValueKind != JsonValueKind.Object)
        {
            throw new JsonException("Sessionize response must be a JSON object.");
        }

        var speakers = new List<WorkshopSpeaker>();
        var speakerBySessionizeId = new Dictionary<string, WorkshopSpeaker>(StringComparer.Ordinal);
        if (root.TryGetProperty("speakers", out var speakerElements) && speakerElements.ValueKind == JsonValueKind.Array)
        {
            foreach (var element in speakerElements.EnumerateArray())
            {
                if (element.ValueKind != JsonValueKind.Object)
                {
                    continue;
                }
                var id = GetString(element, "id");
                if (string.IsNullOrWhiteSpace(id))
                {
                    continue;
                }

                var speaker = new WorkshopSpeaker
                {
                    WorkshopSpeakerId = Guid.NewGuid(),
                    SessionizeId = id,
                    Name = GetString(element, "fullName") ?? JoinName(GetString(element, "firstName"), GetString(element, "lastName")),
                    ProfileImageUrl = GetString(element, "profilePicture"),
                    Description = GetString(element, "bio"),
                    IsActive = true
                };
                speakers.Add(speaker);
                speakerBySessionizeId[id] = speaker;
            }
        }

        var talks = new List<WorkshopTalk>();
        if (root.TryGetProperty("sessions", out var sessionElements) && sessionElements.ValueKind == JsonValueKind.Array)
        {
            foreach (var element in sessionElements.EnumerateArray())
            {
                if (element.ValueKind != JsonValueKind.Object)
                {
                    continue;
                }
                var sessionId = GetString(element, "id");
                if (string.IsNullOrWhiteSpace(sessionId))
                {
                    continue;
                }

                var sessionSpeakers = new List<WorkshopTalkSpeaker>();
                if (element.TryGetProperty("speakers", out var speakerIds) && speakerIds.ValueKind == JsonValueKind.Array)
                {
                    foreach (var speakerIdElement in speakerIds.EnumerateArray())
                    {
                        var speakerId = speakerIdElement.GetString();
                        if (speakerId is not null && speakerBySessionizeId.TryGetValue(speakerId, out var speaker))
                        {
                            sessionSpeakers.Add(new WorkshopTalkSpeaker
                            {
                                WorkshopSpeakerId = speaker.WorkshopSpeakerId,
                                SessionizeId = speaker.SessionizeId,
                                Name = speaker.Name,
                                ImageUrl = speaker.ProfileImageUrl,
                                Biography = speaker.Description
                            });
                        }
                    }
                }

                var isServiceSession = element.TryGetProperty("isServiceSession", out var serviceSession) &&
                    serviceSession.ValueKind == JsonValueKind.True;
                talks.Add(new WorkshopTalk
                {
                    SessionizeId = sessionId,
                    Title = GetString(element, "title"),
                    Abstract = GetString(element, "description"),
                    SessionType = isServiceSession ? "service" : "talk",
                    Speakers = sessionSpeakers
                });
            }
        }

        return new SessionizeImportData { Talks = talks, Speakers = speakers };
    }

    private static bool TryGetValidatedUrl(string? value, out Uri? url)
    {
        url = null;
        if (!Uri.TryCreate(value, UriKind.Absolute, out var candidate) ||
            candidate.Scheme != Uri.UriSchemeHttps ||
            (candidate.Host != "sessionize.com" && candidate.Host != "www.sessionize.com") ||
            !candidate.IsDefaultPort ||
            !string.IsNullOrEmpty(candidate.Query) ||
            !string.IsNullOrEmpty(candidate.Fragment))
        {
            return false;
        }

        var segments = candidate.AbsolutePath.Split('/', StringSplitOptions.RemoveEmptyEntries);
        if (segments.Length != 5 ||
            segments[0] != "api" ||
            segments[1] != "v2" ||
            segments[2].Length == 0 ||
            !segments[2].All(char.IsLetterOrDigit) ||
            segments[3] != "view" ||
            segments[4] != "All")
        {
            return false;
        }

        url = candidate;
        return true;
    }

    private static string? GetString(JsonElement element, string propertyName) =>
        element.TryGetProperty(propertyName, out var property) && property.ValueKind == JsonValueKind.String
            ? property.GetString()
            : null;

    private static string? JoinName(string? firstName, string? lastName) =>
        string.Join(' ', new[] { firstName, lastName }.Where(name => !string.IsNullOrWhiteSpace(name)));
}
