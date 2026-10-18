using DotNetLiguriaCore.Model;

namespace DotNetLiguriaCore.Endpoints;

public sealed class EditorInputFilter : IEndpointFilter
{
    public ValueTask<object?> InvokeAsync(EndpointFilterInvocationContext context, EndpointFilterDelegate next)
    {
        var errors = new Dictionary<string, string[]>();
        foreach (var argument in context.Arguments)
        {
            Validate(argument, errors);
        }
        return errors.Count == 0 ? next(context)
            : ValueTask.FromResult<object?>(Results.ValidationProblem(errors,
                extensions: new Dictionary<string, object?> { ["traceId"] = context.HttpContext.TraceIdentifier }));
    }

    public static void Validate(object? input, Dictionary<string, string[]> errors)
    {
        void Text(string key, string? value, int max) { if (value?.Length > max) errors[key] = ["Testo troppo lungo."]; }
        void Url(string key, string? value, bool local = false)
        {
            if (!IsSafeUrl(value, local)) errors[key] = ["Usa un URL HTTP/HTTPS valido senza credenziali."];
        }
        void Count(string key, int count, int max) { if (count > max) errors[key] = ["Troppi elementi."]; }

        switch (input)
        {
            case Workshop workshop:
                Text("title", workshop.Title, 200);
                Text("description", workshop.Description, 32768);
                Text("blogHtml", workshop.BlogHtml, 262144);
                Text("attendeeNotes", workshop.AttendeeNotes, 32768);
                Text("tags", workshop.Tags, 2000);
                Text("slug", workshop.Slug, 200);
                Url("image", workshop.Image, true);
                Url("imageOld", workshop.ImageOld, true);
                Url("imageThumbnail", workshop.ImageThumbnail, true);
                Url("bookingServiceUrl", workshop.BookingServiceUrl);
                Url("externalRegistrationLink", workshop.ExternalRegistrationLink);
                Url("oldUrl", workshop.OldUrl);
                Count("tracks", workshop.Tracks?.Count ?? 0, 200);
                Count("talks", workshop.Talks?.Count ?? 0, 200);
                Count("agendaTracks", workshop.AgendaTracks?.Count ?? 0, 30);
                Count("agendaItems", workshop.AgendaItems?.Count ?? 0, 1000);
                if (workshop.Talks is null || workshop.AgendaTracks is null || workshop.AgendaItems is null ||
                    workshop.Tracks?.Any(track => track is null) == true ||
                    workshop.Talks?.Any(talk => talk is null || talk.Speakers is null ||
                        talk.Speakers.Any(speaker => speaker is null)) == true ||
                    workshop.AgendaTracks?.Any(track => track is null) == true ||
                    workshop.AgendaItems?.Any(item => item is null) == true)
                {
                    errors["agenda"] = ["Le raccolte non possono contenere valori nulli."];
                    break;
                }
                foreach (var track in workshop.Tracks ?? [])
                {
                    Text("tracks.title", track.Title, 200);
                    Text("tracks.abstract", track.Abstract, 32768);
                    Url("tracks.image", track.Image, true);
                    Count("tracks.speakers", track.Speakers?.Count ?? 0, 50);
                }
                foreach (var talk in workshop.Talks ?? [])
                {
                    Text("talks.title", talk.Title, 200);
                    Text("talks.abstract", talk.Abstract, 32768);
                    Count("talks.speakers", talk.Speakers.Count, 50);
                    foreach (var speaker in talk.Speakers)
                    {
                        Text("talks.speakers.name", speaker.Name, 200);
                        Text("talks.speakers.biography", speaker.Biography, 32768);
                        Url("talks.speakers.imageUrl", speaker.ImageUrl, true);
                    }
                }
                if (workshop.EventbriteTicketCapacity is < 0 or > 100000)
                    errors["eventbriteTicketCapacity"] = ["Capienza non valida."];
                if (workshop.Location is { } location)
                {
                    Text("location.name", location.Name, 200);
                    Text("location.address", location.Address, 1000);
                    Text("location.coordinates", location.Coordinates, 100);
                    Url("location.googleMapsUrl", location.GoogleMapsUrl);
                    Count("location.rooms", location.Rooms?.Count ?? 0, 30);
                    foreach (var room in location.Rooms ?? []) Text("location.rooms", room, 200);
                }
                break;
            case Board board:
                Text("name", board.Name, 200);
                Text("description", board.Description, 32768);
                Text("shortBio", board.ShortBio, 4000);
                Text("fullBio", board.FullBio, 32768);
                Text("blogHtml", board.BlogHtml, 262144);
                Text("email", board.Email, 320);
                Url("profileImageUrl", board.ProfileImageUrl, true);
                Url("linkedinUrl", board.LInkedinUrl);
                Url("twitterUrl", board.TwitterUrl);
                Url("githubUrl", board.GitHubUrl);
                Url("facebookUrl", board.FaceboookUrl);
                Url("instagramUrl", board.InstagramUrl);
                break;
            case WorkshopSpeaker speaker:
                Text("name", speaker.Name, 200);
                Text("description", speaker.Description, 32768);
                Text("email", speaker.Email, 320);
                Text("sessionizeId", speaker.SessionizeId, 200);
                Url("profileImageUrl", speaker.ProfileImageUrl, true);
                break;
            case Venue venue:
                Text("name", venue.Name, 200);
                Text("address", venue.Address, 1000);
                Text("coordinates", venue.Coordinates, 100);
                Url("googleMapsUrl", venue.GoogleMapsUrl);
                if (venue.MaximumSpaces is < 0 or > 100000) errors["maximumSpaces"] = ["Capienza non valida."];
                break;
            case TopMenu menu:
                Text("name", menu.Name, 200);
                Url("url", menu.Url, true);
                break;
            case Counter counter:
                Text("name", counter.Name, 200);
                break;
            case CreateQuestionnaireRequest questionnaire:
                Text("title", questionnaire.Title, 200);
                Text("template", questionnaire.Template, 100);
                break;
        }
    }

    public static bool IsSafeUrl(string? value, bool allowLocal = false)
    {
        if (string.IsNullOrWhiteSpace(value)) return true;
        if (value.Length > 2048 || value.Any(character => char.IsControl(character) || character == '\\')) return false;
        if (allowLocal && !value.StartsWith("//", StringComparison.Ordinal) && !value.Contains(':') &&
            !value.Split('/').Any(segment => segment is "." or ".."))
            return true;
        return Uri.TryCreate(value, UriKind.Absolute, out var uri) &&
            uri.Scheme is "https" or "http" && string.IsNullOrEmpty(uri.UserInfo) && !string.IsNullOrEmpty(uri.Host);
    }
}
