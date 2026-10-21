using System.Globalization;
using System.Text.RegularExpressions;

namespace DotNetLiguriaCore.Services.Newsletters;

public sealed class NewsletterTemplateEngine
{
    private static readonly string[] _tokens =
    [
        "event.title", "event.date", "event.startTime", "event.endTime",
        "event.location.name", "event.location.address", "event.location.mapUrl",
        "event.url", "event.talksMarkdown"
    ];
    private static readonly Regex _tokenPattern = new(@"\{\{([^{}]+)\}\}", RegexOptions.CultureInvariant);

    public IReadOnlyList<string> Placeholders => _tokens;

    public string Render(string template, NewsletterEventProjection projection)
    {
        ArgumentNullException.ThrowIfNull(template);
        ArgumentNullException.ThrowIfNull(projection);
        Validate(template, eventTemplate: true);
        var values = Values(projection);
        var replaced = _tokenPattern.Replace(template, match =>
        {
            var key = match.Groups[1].Value.Trim();
            if (!values.TryGetValue(key, out var value))
                throw new NewsletterServiceException("unknown_template_placeholder", 400);
            return value;
        });
        return replaced;
    }

    public string RenderSubject(string template, NewsletterEventProjection projection)
    {
        ValidateSubject(template, eventTemplate: true);
        if (_tokenPattern.Matches(template).Any(match =>
                match.Groups[1].Value.Trim() == "event.talksMarkdown"))
            throw new NewsletterServiceException("body_placeholder_in_subject", 400);
        var values = Values(projection, escapeText: false);
        return _tokenPattern.Replace(template, match => values[match.Groups[1].Value.Trim()]);
    }

    public void Validate(string template, bool eventTemplate)
    {
        if (string.IsNullOrWhiteSpace(template) || template.Length > 20_000)
            throw new NewsletterServiceException("invalid_template_content", 400);
        foreach (Match match in _tokenPattern.Matches(template))
            if (!_tokens.Contains(match.Groups[1].Value.Trim(), StringComparer.Ordinal))
                throw new NewsletterServiceException("unknown_template_placeholder", 400);
        if (!eventTemplate && _tokenPattern.IsMatch(template))
            throw new NewsletterServiceException("event_placeholder_in_generic_template", 400);
        var literal = _tokenPattern.Replace(template, "");
        if (literal.Contains("{{", StringComparison.Ordinal) || literal.Contains("}}", StringComparison.Ordinal))
            throw new NewsletterServiceException("malformed_template_placeholder", 400);
    }

    public void ValidateSubject(string subject, bool eventTemplate)
    {
        Validate(subject, eventTemplate);
        if (subject.Any(char.IsControl) || subject.Length > 200)
            throw new NewsletterServiceException("invalid_subject", 400);
    }

    private static Dictionary<string, string> Values(NewsletterEventProjection projection, bool escapeText = true)
    {
        string Text(string value) => escapeText ? EscapeMarkdown(value) : value;
        var talks = string.Join(Environment.NewLine, projection.Talks.Select(talk =>
            $"- {(string.IsNullOrWhiteSpace(talk.TrackName) ? "" : $"**{EscapeMarkdown(talk.TrackName)}** · ")}{EscapeMarkdown(talk.Title)}" +
            (talk.Speakers.Length == 0 ? "" : $" — {EscapeMarkdown(string.Join(", ", talk.Speakers))}") +
            (string.IsNullOrWhiteSpace(talk.StartTime) ? "" : $" ({talk.StartTime})")));
        return new Dictionary<string, string>(StringComparer.Ordinal)
        {
            ["event.title"] = Text(projection.Title),
            ["event.date"] = projection.Date.ToString("d MMMM yyyy", CultureInfo.GetCultureInfo("it-IT")),
            ["event.startTime"] = Text(projection.StartTime ?? ""),
            ["event.endTime"] = Text(projection.EndTime ?? ""),
            ["event.location.name"] = Text(projection.LocationName ?? ""),
            ["event.location.address"] = Text(projection.LocationAddress ?? ""),
            ["event.location.mapUrl"] = SafeLink(projection.MapUrl, escapeText),
            ["event.url"] = SafeLink(projection.Url, escapeText),
            ["event.talksMarkdown"] = talks
        };
    }

    private static string EscapeMarkdown(string value) =>
        Regex.Replace(value, @"([\\`*_{}\[\]()#+\-.!|>])", @"\$1", RegexOptions.CultureInvariant);

    private static string SafeLink(string? value, bool markdown) =>
        Uri.TryCreate(value, UriKind.Absolute, out var uri) && uri.Scheme is "https" or "http" &&
        string.IsNullOrEmpty(uri.UserInfo)
            ? markdown ? $"<{uri.AbsoluteUri.Replace(">", "%3E").Replace("<", "%3C")}>" : uri.AbsoluteUri
            : "";
}
