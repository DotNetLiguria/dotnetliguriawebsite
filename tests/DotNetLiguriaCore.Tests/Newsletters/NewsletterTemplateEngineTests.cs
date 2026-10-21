using DotNetLiguriaCore.Services.Newsletters;
using Xunit;

namespace DotNetLiguriaCore.Tests.Newsletters;

public sealed class NewsletterTemplateEngineTests
{
    private readonly NewsletterTemplateEngine _engine = new();

    [Fact]
    public void RendersKnownTokensWithoutRecursivelyEvaluatingInsertedValues()
    {
        var projection = new NewsletterEventProjection
        {
            Id = "event-1",
            Title = "{{event.url}}",
            Url = "https://events.example.test",
            Date = new DateOnly(2026, 10, 21),
            TimeZone = "Europe/Rome"
        };

        var actual = _engine.Render("Annuncio {{event.title}} — {{event.date}}", projection);

        Assert.Contains(@"\{\{event\.url\}\}", actual);
        Assert.DoesNotContain("https://events.example.test", actual);
    }

    [Fact]
    public void AcceptsEveryKnownPlaceholderAndRendersSubjectAsPlainText()
    {
        foreach (var token in _engine.Placeholders)
            _engine.Validate("{{" + token + "}}", eventTemplate: true);
        var projection = Event();
        projection.Title = ".NET [Liguria] - C#";
        Assert.Equal(projection.Title, _engine.RenderSubject("{{event.title}}", projection));
        Assert.Throws<NewsletterServiceException>(() =>
            _engine.RenderSubject("{{event.talksMarkdown}}", projection));
    }

    [Fact]
    public void RejectsUnknownAndMalformedTokens()
    {
        Assert.Equal("unknown_template_placeholder", Assert.Throws<NewsletterServiceException>(() =>
            _engine.Validate("{{event.secret}}", eventTemplate: true)).Code);
        Assert.Equal("malformed_template_placeholder", Assert.Throws<NewsletterServiceException>(() =>
            _engine.Validate("{{event.title", eventTemplate: true)).Code);
    }

    [Fact]
    public void GenericTemplatesRejectEventTokens()
    {
        Assert.Equal("event_placeholder_in_generic_template", Assert.Throws<NewsletterServiceException>(() =>
            _engine.Validate("Ciao {{event.title}}", eventTemplate: false)).Code);

        _engine.Validate("Ciao, scrivi qui.", eventTemplate: false);
    }

    [Fact]
    public void SubjectRejectsHeaderInjection()
    {
        Assert.Equal("invalid_subject", Assert.Throws<NewsletterServiceException>(() =>
            _engine.ValidateSubject("News\r\nBcc: list@example.test", eventTemplate: false)).Code);
    }

    private static NewsletterEventProjection Event() => new()
    {
        Id = Guid.NewGuid().ToString("D"),
        Title = "Evento",
        Url = "https://events.example.test",
        Date = new DateOnly(2026, 10, 21),
        TimeZone = "Europe/Rome"
    };
}
