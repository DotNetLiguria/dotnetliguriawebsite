using DotNetLiguriaCore.Services.Newsletters;
using MimeKit;

namespace DotNetLiguriaCore.Tests.Newsletters;

public sealed class ControlledNewsletterTransport : INewsletterSmtpTransport
{
    public TaskCompletionSource Started { get; } = new(TaskCreationOptions.RunContinuationsAsynchronously);
    public TaskCompletionSource<NewsletterTransportResult> Completion { get; } = new(TaskCreationOptions.RunContinuationsAsynchronously);
    public Action? OnSending { get; set; }
    public int Calls { get; private set; }
    public CancellationToken SendToken { get; private set; }

    public Task<NewsletterTransportResult> SendAsync(MimeMessage message, string recipient,
        NewsletterOptions options, CancellationToken cancellationToken)
    {
        Calls++;
        SendToken = cancellationToken;
        OnSending?.Invoke();
        Started.TrySetResult();
        return Completion.Task;
    }
}
