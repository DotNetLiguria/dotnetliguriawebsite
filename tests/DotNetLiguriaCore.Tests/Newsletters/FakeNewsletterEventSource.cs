using System.Text.Json;
using DotNetLiguriaCore.Services.Newsletters;

namespace DotNetLiguriaCore.Tests.Newsletters;

public sealed class FakeNewsletterEventSource : INewsletterEventSource
{
    public Dictionary<Guid, NewsletterEventProjection> Events { get; } = [];
    private static NewsletterEventProjection Clone(NewsletterEventProjection projection) =>
        JsonSerializer.Deserialize<NewsletterEventProjection>(JsonSerializer.Serialize(projection))!;
    public Task<IReadOnlyList<NewsletterEventProjection>> ListEligibleAsync(CancellationToken cancellationToken) =>
        Task.FromResult<IReadOnlyList<NewsletterEventProjection>>(Events.Values.Select(Clone).ToArray());
    public Task<NewsletterEventProjection> GetEligibleAsync(Guid id, CancellationToken cancellationToken) =>
        Task.FromResult(Clone(Events[id]));
}
