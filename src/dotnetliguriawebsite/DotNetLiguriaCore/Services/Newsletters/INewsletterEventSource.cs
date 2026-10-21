namespace DotNetLiguriaCore.Services.Newsletters;

public interface INewsletterEventSource
{
    Task<IReadOnlyList<NewsletterEventProjection>> ListEligibleAsync(CancellationToken cancellationToken);
    Task<NewsletterEventProjection> GetEligibleAsync(Guid id, CancellationToken cancellationToken);
}
