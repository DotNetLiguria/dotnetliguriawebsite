using DotNetLiguriaCore.Authorization;
using DotNetLiguriaCore.Model;
using DotNetLiguriaCore.Services.Privacy;
using Microsoft.Extensions.Options;
using MongoDB.Driver;

namespace DotNetLiguriaCore.Services.Newsletters;

public sealed class NewsletterEventSource : INewsletterEventSource
{
    private readonly IMongoCollection<Workshop> _workshops;
    private readonly TimeProvider _clock;
    private readonly TimeZoneInfo _zone;
    private readonly IOptionsMonitor<NewsletterOptions> _newsletterOptions;

    public NewsletterEventSource(IOptions<DotNetLiguriaDatabaseSettings> databaseOptions,
        IConfiguration configuration, IOptionsMonitor<NewsletterOptions> newsletterOptions, TimeProvider clock)
    {
        var database = new MongoClient(databaseOptions.Value.ConnectionString)
            .GetDatabase(databaseOptions.Value.DatabaseName);
        _workshops = database.GetCollection<Workshop>(databaseOptions.Value.WorkshopCollectionName);
        _clock = clock;
        _zone = TimeZoneInfo.FindSystemTimeZoneById(configuration["Authorization:EventTimeZoneId"] ?? "Europe/Rome");
        _newsletterOptions = newsletterOptions;
    }

    public async Task<IReadOnlyList<NewsletterEventProjection>> ListEligibleAsync(CancellationToken cancellationToken)
    {
        var today = TimeZoneInfo.ConvertTime(_clock.GetUtcNow(), _zone).Date;
        var workshops = await _workshops.Find(item => item.Published == true && item.EventDate >= today)
            .SortBy(item => item.EventDate)
            .Limit(501).ToListAsync(cancellationToken);
        if (workshops.Count > 500)
            throw new NewsletterServiceException("newsletter_event_list_limit_exceeded", 409);
        return workshops.Select(SafeProjectionIfEligible).Where(item => item is not null)
            .Cast<NewsletterEventProjection>().Take(500).ToArray();
    }

    public async Task<NewsletterEventProjection> GetEligibleAsync(Guid id, CancellationToken cancellationToken)
    {
        var workshop = await _workshops.Find(item => item.WorkshopId == id && item.Published == true)
            .FirstOrDefaultAsync(cancellationToken);
        if (workshop is null)
            throw new NewsletterServiceException("event_not_published", 409);
        if (workshop.EventDate is null)
            throw new NewsletterServiceException("event_date_required", 409);
        try
        {
            if (EventPeriod.IsPast(workshop, _clock, _zone))
                throw new NewsletterServiceException("event_no_longer_eligible", 409);
        }
        catch (PrivacyBlockedException)
        {
            throw new NewsletterServiceException("event_schedule_invalid", 409);
        }
        try
        {
            return CreateProjection(workshop) ??
                throw new NewsletterServiceException("event_no_longer_eligible", 409);
        }
        catch (ArgumentException)
        {
            throw new NewsletterServiceException("event_talk_data_invalid", 409);
        }
    }

    public NewsletterEventProjection? CreateProjection(Workshop item)
    {
        if (item.Published != true || item.EventDate is null) return null;
        try
        {
            if (EventPeriod.IsPast(item, _clock, _zone)) return null;
        }
        catch (Exception exception) when (exception is ArgumentException or InvalidOperationException or PrivacyBlockedException)
        {
            return null;
        }

        var date = item.EventDate.Value.Date;
        if (date.Year is < 1900 or > 9998 || string.IsNullOrWhiteSpace(item.Title))
            return null;
        var modern = item.Talks is { Count: > 0 };
        var modernSchedule = item.AgendaItems is { Count: > 0 };
        var talks = modern
            ? ModernTalks(item, date)
            : LegacyTalks(item, date);
        (DateTime StartTime, DateTime EndTime)[] schedule = modernSchedule
            ? item.AgendaItems.Where(entry => IsUsable(entry) && ValidLocal(date, entry.StartTime) && ValidLocal(date, entry.EndTime))
                .OrderBy(entry => entry.StartTime).ThenBy(entry => entry.Order)
                .Select(entry => (entry.StartTime, entry.EndTime)).ToArray()
            : (item.Tracks ?? []).Where(entry => IsUsable(entry) &&
                ValidLocal(date, entry.StartTime) && ValidLocal(date, entry.EndTime)).OrderBy(entry => entry.StartTime)
                .Select(entry => (entry.StartTime, entry.EndTime)).ToArray();
        var baseUrl = _newsletterOptions.CurrentValue.PublicBaseUrl.TrimEnd('/');
        return new NewsletterEventProjection
        {
            Id = item.WorkshopId.ToString("D"),
            Title = item.Title.Trim(),
            Url = Uri.TryCreate(baseUrl + "/", UriKind.Absolute, out var baseUri) &&
                baseUri.Scheme == Uri.UriSchemeHttps && string.IsNullOrEmpty(baseUri.UserInfo) &&
                string.IsNullOrEmpty(baseUri.Query) && string.IsNullOrEmpty(baseUri.Fragment)
                ? new Uri(baseUri, $"workshop/{item.WorkshopId:D}").AbsoluteUri : "",
            Date = DateOnly.FromDateTime(date),
            TimeZone = _zone.Id,
            StartTime = schedule.Length > 0 ? schedule.Min(entry => entry.StartTime).ToString("HH:mm") : null,
            EndTime = schedule.Length > 0 ? schedule.Max(entry => entry.EndTime).ToString("HH:mm") : null,
            LocationName = string.IsNullOrWhiteSpace(item.Location?.Name) ? null : item.Location.Name.Trim(),
            LocationAddress = string.IsNullOrWhiteSpace(item.Location?.Address) ? null : item.Location.Address.Trim(),
            MapUrl = SafeMapUrl(item.Location?.GoogleMapsUrl),
            Talks = talks
        };
    }

    private NewsletterEventProjection? SafeProjectionIfEligible(Workshop item)
    {
        try
        {
            return CreateProjection(item);
        }
        catch (Exception exception) when (exception is ArgumentException or InvalidOperationException)
        {
            return null;
        }
    }

    private List<NewsletterTalkProjection> ModernTalks(Workshop workshop, DateTime date)
    {
        var talks = (workshop.Talks ?? []).Where(talk => talk is not null)
            .ToDictionary(talk => talk.WorkshopTalkId);
        var tracks = (workshop.AgendaTracks ?? []).Where(track => track is not null)
            .ToDictionary(track => track.WorkshopAgendaTrackId, track => track.Name);
        var result = new List<NewsletterTalkProjection>();
        foreach (var agenda in (workshop.AgendaItems ?? []).Where(item => item is not null)
            .OrderBy(item => item.StartTime).ThenBy(item => item.Order))
        {
            if (agenda.TalkId is not { } id || !talks.TryGetValue(id, out var talk) ||
                string.IsNullOrWhiteSpace(talk.Title)) continue;
            result.Add(new NewsletterTalkProjection
            {
                Title = talk.Title.Trim(),
                Speakers = (talk.Speakers ?? []).Select(speaker => speaker.Name?.Trim())
                    .Where(name => !string.IsNullOrWhiteSpace(name)).Cast<string>().ToArray(),
                StartTime = IsUsable(agenda) && ValidLocal(date, agenda.StartTime) && ValidLocal(date, agenda.EndTime)
                    ? agenda.StartTime.ToString("HH:mm") : null,
                EndTime = IsUsable(agenda) && ValidLocal(date, agenda.StartTime) && ValidLocal(date, agenda.EndTime)
                    ? agenda.EndTime.ToString("HH:mm") : null,
                RoomName = string.IsNullOrWhiteSpace(agenda.RoomName) ? null : agenda.RoomName.Trim(),
                TrackName = agenda.TrackId is { } trackId && tracks.TryGetValue(trackId, out var trackName)
                    ? trackName : null
            });
        }
        if (result.Count == 0)
            result.AddRange((workshop.Talks ?? []).Where(talk => talk is not null && !string.IsNullOrWhiteSpace(talk.Title)).Select(talk =>
                new NewsletterTalkProjection
                {
                    Title = talk.Title!.Trim(),
                    Speakers = (talk.Speakers ?? []).Select(speaker => speaker.Name?.Trim())
                        .Where(name => !string.IsNullOrWhiteSpace(name)).Cast<string>().ToArray()
                }));
        return result;
    }

    private List<NewsletterTalkProjection> LegacyTalks(Workshop workshop, DateTime date) =>
        (workshop.Tracks ?? []).Where(track => track is not null && !string.IsNullOrWhiteSpace(track.Title))
            .OrderBy(track => track.StartTime)
            .Select(track => new NewsletterTalkProjection
            {
                Title = track.Title!.Trim(),
                Speakers = track.SpeakersDetails is { Count: > 0 }
                    ? track.SpeakersDetails.Where(name => !string.IsNullOrWhiteSpace(name)).Select(name => name.Trim()).ToArray()
                    : string.IsNullOrWhiteSpace(track.SpeakersName) ? [] : [track.SpeakersName.Trim()],
                StartTime = IsUsable(track) && ValidLocal(date, track.StartTime) && ValidLocal(date, track.EndTime)
                    ? track.StartTime.ToString("HH:mm") : null,
                EndTime = IsUsable(track) && ValidLocal(date, track.StartTime) && ValidLocal(date, track.EndTime)
                    ? track.EndTime.ToString("HH:mm") : null
            }).ToList();

    private static bool IsUsable(WorkshopAgendaItem item) =>
        item.StartTime != default && item.EndTime != default && item.EndTime > item.StartTime;

    private static bool IsUsable(WorkshopTrack item) =>
        item.StartTime != default && item.EndTime != default && item.EndTime > item.StartTime;

    private bool ValidLocal(DateTime eventDate, DateTime value) =>
        value != default && !_zone.IsInvalidTime(
            DateTime.SpecifyKind(eventDate.Date.Add(value.TimeOfDay), DateTimeKind.Unspecified));

    private static string? SafeMapUrl(string? value) =>
        Uri.TryCreate(value, UriKind.Absolute, out var uri) &&
        uri.Scheme is "https" or "http" && string.IsNullOrEmpty(uri.UserInfo) ? uri.ToString() : null;
}
