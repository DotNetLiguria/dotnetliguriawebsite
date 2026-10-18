using DotNetLiguriaCore.Services.Privacy.Notices;
using Microsoft.Extensions.Options;

namespace DotNetLiguriaCore.Tests.Privacy;

internal sealed class NoticeOptionsMonitor(PrivacySmtpOptions value) : IOptionsMonitor<PrivacySmtpOptions>
{
    public PrivacySmtpOptions CurrentValue { get; } = value;
    public PrivacySmtpOptions Get(string? name) => CurrentValue;
    public IDisposable? OnChange(Action<PrivacySmtpOptions, string?> listener) => null;
}
