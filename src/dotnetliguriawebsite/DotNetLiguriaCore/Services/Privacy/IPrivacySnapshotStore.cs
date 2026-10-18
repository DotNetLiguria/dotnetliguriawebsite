namespace DotNetLiguriaCore.Services.Privacy;

public interface IPrivacySnapshotStore
{
    Task PurgeForErasureUnderGateAsync(CancellationToken cancellationToken);
}
