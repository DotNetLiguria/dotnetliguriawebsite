using DotNetLiguriaCore.Services.Privacy;

namespace DotNetLiguriaCore.Tests.Privacy;

internal sealed class FakePrivacySnapshotStore : IPrivacySnapshotStore
{
    public bool FailPurge { get; set; }
    public int Purges { get; private set; }
    public Task PurgeForErasureUnderGateAsync(CancellationToken cancellationToken)
    {
        if (FailPurge) throw new IOException("Synthetic failure");
        Purges++;
        return Task.CompletedTask;
    }
}
